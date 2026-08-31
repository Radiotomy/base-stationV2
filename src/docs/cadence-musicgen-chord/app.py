"""
Cadence — BASE Station's chord-conditioned instrumental bed engine.

Hugging Face Space: radiotomy/cadence   ·   GPU: T4 small or better
Endpoint contract mirrors Sever and Cantor: POST /generate -> job id, GET /status/{id}.

=============================================================================
WHY THIS EXISTS AND WHY IT NEEDS NO CUSTOM CHECKPOINT
=============================================================================
MusicGen-Chord (Jung et al., arXiv:2412.00325) is not a fine-tune. It is a
CONDITIONING TRICK on stock `facebook/musicgen-melody` weights:

    MusicGen-Melody conditions on ONE-hot chroma  (one pitch class per frame)
    MusicGen-Chord  conditions on MULTI-hot chroma (a whole chord per frame)

The paper is explicit that this "works surprisingly well ... using the
pretrained MusicGen model weights, without requiring any fine-tuning." So the
entire model is: build the right 12-dimensional matrix, hand it to the melody
conditioner. That is what this file does.

Consequences worth stating plainly, because they are the reason we self-host:
  * No weights to license, host, or lose. We pull Meta's public checkpoint.
  * The conditioning is OURS, in readable Python, ~60 lines. Chord vocabulary,
    voicing, bar subdivision and progression looping are all tunable here — on
    Replicate they were unreachable behind a fixed model version.
  * This is the file that moves to our own GPU. Nothing about it is HF-specific
    except the port and the output mount.

=============================================================================
THE ONE LOAD-BEARING TRICK: SELF-CALIBRATING FRAME COUNT
=============================================================================
The conditioner expects chroma at ITS OWN internal frame rate, which is a
function of audiocraft's chroma hop size and can change between versions.
Hardcoding a frame rate is the standard way this integration silently rots:
a wrong T does not error, it just smears the harmony.

So we never guess. The patched conditioner calls the ORIGINAL implementation on
the incoming (silent) reference wav, reads the exact [B, T, 12] shape audiocraft
wanted, and builds our chord matrix at precisely that T. Version-proof by
construction.

=============================================================================
SERIAL EXECUTION IS DELIBERATE
=============================================================================
Concurrent requests against a single CUDA-resident model produce
"Cannot copy out of meta tensor" — the same failure that bit Coda and Siren
Song. One worker, queued jobs. A queue means a longer wait; concurrency means
a crash, and a crash costs the creator their generation.
"""

import os
import uuid
import threading
import traceback
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

OUTPUT_DIR = "/tmp/outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# STEREO checkpoint. Same architecture and the same multi-hot chroma conditioning
# as musicgen-melody — the stereo variant just decodes two channels — so the
# ChordInjector below needs no change. Still 32 kHz: that is MusicGen's native
# decoder rate and no checkpoint raises it. Resampling to 48 kHz would add bytes,
# not information, so it is done at the SUB-Station import boundary (for format
# compatibility with 48 kHz vocal renders) rather than pretended at here.
MODEL_NAME = "facebook/musicgen-stereo-melody"
SAMPLE_RATE = 32000

# One worker, on purpose. See header.
POOL = ThreadPoolExecutor(max_workers=1)
JOBS = {}
JOBS_LOCK = threading.Lock()

_model = None
_model_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Chord vocabulary — ROOT:TYPE, the Harte-style notation MusicGen-Chord uses.
# ---------------------------------------------------------------------------

ROOTS = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "Fb": 4,
    "E#": 5, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9,
    "A#": 10, "Bb": 10, "B": 11, "Cb": 11,
}

# Semitone offsets from the root. Extensions are included because a writer who
# typed maj7 wants the 7th to sound — dropping it would quietly simplify their
# harmony, which is the one thing a score-adherent engine must not do.
CHORD_TYPES = {
    "maj":      [0, 4, 7],
    "min":      [0, 3, 7],
    "dim":      [0, 3, 6],
    "aug":      [0, 4, 8],
    "sus2":     [0, 2, 7],
    "sus4":     [0, 5, 7],
    "5":        [0, 7],
    "7":        [0, 4, 7, 10],
    "maj7":     [0, 4, 7, 11],
    "min7":     [0, 3, 7, 10],
    "minmaj7":  [0, 3, 7, 11],
    "dim7":     [0, 3, 6, 9],
    "hdim7":    [0, 3, 6, 10],
    "maj6":     [0, 4, 7, 9],
    "min6":     [0, 3, 7, 9],
    "9":        [0, 4, 7, 10, 2],
    "maj9":     [0, 4, 7, 11, 2],
    "min9":     [0, 3, 7, 10, 2],
    "11":       [0, 4, 7, 10, 2, 5],
    "min11":    [0, 3, 7, 10, 2, 5],
    "13":       [0, 4, 7, 10, 2, 9],
    "maj13":    [0, 4, 7, 11, 2, 9],
}


def chord_pitch_classes(symbol):
    """'A:min7' -> {9, 0, 4, 7}. Unknown or 'N' (no chord) -> empty set."""
    token = (symbol or "").strip()
    if not token or token.upper() in ("N", "NC", "N.C."):
        return set()

    if ":" in token:
        root_name, type_name = token.split(":", 1)
    else:
        root_name, type_name = token, "maj"

    root_name = root_name.strip()
    type_name = (type_name.strip() or "maj").split("/")[0]  # drop slash bass

    if root_name not in ROOTS:
        return set()
    root = ROOTS[root_name]
    intervals = CHORD_TYPES.get(type_name)
    if intervals is None:
        # An unrecognised extension degrades to the plain triad rather than to
        # silence — a wrong-but-harmonic bar beats a hole in the progression.
        intervals = CHORD_TYPES["min"] if type_name.startswith("min") else CHORD_TYPES["maj"]
    return {(root + i) % 12 for i in intervals}


def build_chord_chroma(text_chords, bpm, time_sig, frames, duration):
    """
    The whole model, in one function: a [frames, 12] multi-hot matrix.

    Bars are space-separated; commas subdivide one bar equally
    ('C G:7 A:min,D:7' = bar of C, bar of G7, bar split between Am and D7).
    The progression loops until the requested duration is filled, so a 4-bar
    chart can carry a 60-second bed without the writer restating it.
    """
    bars = [b for b in text_chords.replace("|", " ").split() if b]
    if not bars:
        return np.zeros((frames, 12), dtype=np.float32)

    try:
        beats_per_bar = int(str(time_sig).split("/")[0])
    except (ValueError, IndexError):
        beats_per_bar = 4
    beats_per_bar = max(1, beats_per_bar)

    seconds_per_bar = beats_per_bar * 60.0 / max(1.0, float(bpm))
    frames_per_second = frames / max(1e-6, float(duration))

    chroma = np.zeros((frames, 12), dtype=np.float32)
    position = 0.0  # seconds

    while position < duration:
        for bar in bars:
            slots = [s for s in bar.split(",") if s]
            slot_seconds = seconds_per_bar / len(slots)
            for slot in slots:
                pcs = chord_pitch_classes(slot)
                start = int(round(position * frames_per_second))
                end = int(round((position + slot_seconds) * frames_per_second))
                start = max(0, min(frames, start))
                end = max(0, min(frames, end))
                if pcs and end > start:
                    for pc in pcs:
                        chroma[start:end, pc] = 1.0
                position += slot_seconds
                if position >= duration:
                    return chroma
    return chroma


# ---------------------------------------------------------------------------
# Model — lazily loaded so the Space boots even while the GPU is cold.
# ---------------------------------------------------------------------------

class ChordInjector:
    """
    Replaces the melody conditioner's chroma with our chord chroma.

    Holds the pending matrix spec rather than a tensor, because the frame count
    is only knowable once audiocraft tells us what it wanted — see header.
    """

    def __init__(self, conditioner):
        self.conditioner = conditioner
        self.original = conditioner._get_wav_embedding
        self.pending = None
        conditioner._get_wav_embedding = self._patched

    def _patched(self, x):
        reference = self.original(x)  # [B, T, 12] — the shape audiocraft wants
        if self.pending is None:
            return reference
        spec = self.pending
        frames = reference.shape[1]
        chroma = build_chord_chroma(
            spec["text_chords"], spec["bpm"], spec["time_sig"], frames, spec["duration"]
        )
        out = torch.from_numpy(chroma).to(reference.device, reference.dtype)
        return out.unsqueeze(0).expand(reference.shape[0], -1, -1).contiguous()


def get_model():
    global _model
    with _model_lock:
        if _model is None:
            from audiocraft.models import MusicGen
            model = MusicGen.get_pretrained(MODEL_NAME)
            conditioner = model.lm.condition_provider.conditioners["self_wav"]
            model._chord_injector = ChordInjector(conditioner)
            _model = model
        return _model


def run_job(job_id, payload):
    try:
        model = get_model()
        duration = float(payload["duration"])

        model.set_generation_params(
            duration=duration,
            temperature=float(payload.get("temperature", 1.0)),
            cfg_coef=float(payload.get("cfg_coef", 3.0)),
            top_k=int(payload.get("top_k", 250)),
        )

        model._chord_injector.pending = {
            "text_chords": payload["text_chords"],
            "bpm": float(payload["bpm"]),
            "time_sig": payload.get("time_sig", "4/4"),
            "duration": duration,
        }

        # Silent reference wav: it exists only so audiocraft runs its chroma
        # path and reveals the frame count. Its CONTENT is irrelevant — the
        # injector discards it. This is why no audio is uploaded to generate a
        # bed from a typed chart.
        silence = torch.zeros(1, int(SAMPLE_RATE * duration))

        with torch.no_grad():
            wav = model.generate_with_chroma(
                descriptions=[payload["prompt"]],
                melody_wavs=silence,
                melody_sample_rate=SAMPLE_RATE,
                progress=False,
            )

        # wav[0] is [channels, samples]; soundfile wants [samples, channels].
        # The stereo checkpoint yields 2 channels here, mono yields 1 — the
        # transpose covers both, so nothing downstream has to know which
        # checkpoint produced the file.
        audio = wav[0].cpu().numpy().T
        channels = audio.shape[1] if audio.ndim > 1 else 1
        path = os.path.join(OUTPUT_DIR, f"{job_id}.wav")
        # soundfile, not torchaudio.save — torchcodec fails to load on the HF
        # Space image, the same wall Cantor hit.
        sf.write(path, audio, SAMPLE_RATE, subtype="PCM_16")

        model._chord_injector.pending = None

        with JOBS_LOCK:
            JOBS[job_id] = {
                "status": "completed",
                "audio": f"/outputs/{job_id}.wav",
                "duration": duration,
                "sample_rate": SAMPLE_RATE,
                "channels": channels,
            }
    except Exception as e:
        traceback.print_exc()
        try:
            get_model()._chord_injector.pending = None
        except Exception:
            pass
        with JOBS_LOCK:
            JOBS[job_id] = {"status": "failed", "error": f"{type(e).__name__}: {e}"}


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

app = FastAPI(title="Cadence — chord-conditioned bed engine")


class GenerateRequest(BaseModel):
    prompt: str
    text_chords: str
    bpm: float = 120.0
    time_sig: str = "4/4"
    duration: float = 30.0
    temperature: float = 1.0
    cfg_coef: float = 3.0
    top_k: int = 250


@app.get("/health")
def health():
    with JOBS_LOCK:
        queued = sum(1 for j in JOBS.values() if j.get("status") == "processing")
    return {
        "status": "ok",
        "engine": "cadence",
        "model": MODEL_NAME,
        "conditioning": "multi-hot chord chroma",
        "sample_rate": SAMPLE_RATE,
        "stereo": "stereo" in MODEL_NAME,
        "loaded": _model is not None,
        "cuda": torch.cuda.is_available(),
        "in_flight": queued,
    }


@app.post("/generate")
def generate(req: GenerateRequest):
    if not req.text_chords.strip():
        return {"error": "text_chords is required"}
    if not req.prompt.strip():
        return {"error": "prompt is required"}

    job_id = uuid.uuid4().hex
    with JOBS_LOCK:
        JOBS[job_id] = {"status": "processing"}
    POOL.submit(run_job, job_id, req.dict())
    return {"job_id": job_id, "status": "processing"}


@app.get("/status/{job_id}")
def status(job_id: str):
    with JOBS_LOCK:
        return JOBS.get(job_id, {"status": "not_found"})


app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)