"""
Cantor — BASE Station's DiffSinger singing-voice engine.

Renders a HUMAN-AUTHORED melody (syllable + MIDI pitch + beat length) into sung
vocals using DiffSinger ONNX voicebanks.

Design notes that are load-bearing:

* THE MELODY IS NOT NEGOTIABLE. The requested pitches are written straight into
  the f0 curve. Nothing here smooths, re-harmonizes or "improves" the line,
  because a render that drifts off the authored notes silently destroys the
  authorship claim this whole engine exists to support.

* RENDERING IS ASYNCHRONOUS. A diffusion vocal render on CPU takes minutes, far
  past any sane HTTP timeout, so /render returns a job id and the caller polls
  /status. Inline would guarantee gateway timeouts.

* ONE JOB AT A TIME. max_workers=1 is deliberate. Concurrent renders each hold a
  full acoustic model plus a full mel tensor in RAM — exactly how the Coda and
  Siren Song Spaces earn their meta-tensor / OOM crashes. Queueing is slower but
  never fails.

* SESSIONS CACHED PER BANK, LAZILY. Loading an acoustic model costs seconds and
  hundreds of MB. At import time that fails the Space boot health check; per
  request it multiplies the cost by every job.

* VOICEBANKS LIVE IN /data, NOT IN THIS IMAGE. /data is the persistent mount; a
  bank under /tmp would need re-uploading on every restart. The engine ships with
  no voices on purpose — each bank carries its own licence.

* soundfile, NOT torchaudio. torchaudio's native backend does not load on the HF
  Space image (an already-paid-for lesson from Skye), and this Space has no torch
  at all — onnxruntime only.
"""

import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import onnxruntime as ort
import soundfile as sf
import yaml
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

OUT = Path("/tmp/outputs")
OUT.mkdir(parents=True, exist_ok=True)

BANK_DIR = Path(os.environ.get("VOICEBANK_DIR", "/data/voicebanks"))

app = FastAPI(title="Cantor", description="DiffSinger singing voice synthesis")
# Static mount so a finished render is a plain downloadable URL. The backend copies
# it into Base44 storage — a /tmp file on a sleeping Space is gone.
app.mount("/outputs", StaticFiles(directory=str(OUT)), name="outputs")

JOBS: Dict[str, dict] = {}
POOL = ThreadPoolExecutor(max_workers=1)
_sessions: Dict[str, dict] = {}

# DiffSinger acoustic models are trained at a fixed frame rate. 512-sample hop at
# 44.1kHz is the community default; a bank that differs declares it in dsconfig.
DEFAULT_SAMPLE_RATE = 44100
DEFAULT_HOP = 512


# ----------------------------------------------------------------------------- banks


def _bank_paths(path: Path) -> dict:
    """Locate a bank's parts. Missing pieces are reported, never guessed at."""
    cfg_file = path / "dsconfig.yaml"
    cfg = {}
    if cfg_file.exists():
        try:
            cfg = yaml.safe_load(cfg_file.read_text(encoding="utf-8")) or {}
        except Exception:
            cfg = {}

    def resolve(key: str, fallback: str) -> Optional[Path]:
        named = cfg.get(key)
        if named:
            candidate = path / str(named)
            if candidate.exists():
                return candidate
        candidate = path / fallback
        return candidate if candidate.exists() else None

    licence = ""
    for name in ("LICENSE", "LICENSE.txt", "LICENCE", "README.md"):
        f = path / name
        if f.exists():
            licence = f.read_text(encoding="utf-8", errors="ignore").strip()[:400]
            break

    return {
        "acoustic": resolve("acoustic", "acoustic.onnx"),
        "vocoder": resolve("vocoder", "vocoder.onnx"),
        "dictionary": resolve("dictionary", "dictionary.txt"),
        "phonemes": cfg.get("phonemes"),
        "sample_rate": int(cfg.get("sample_rate") or DEFAULT_SAMPLE_RATE),
        "hop_size": int(cfg.get("hop_size") or DEFAULT_HOP),
        "name": cfg.get("name") or path.name,
        "language": cfg.get("language") or "",
        "license": licence,
    }


def list_banks() -> List[dict]:
    if not BANK_DIR.exists():
        return []
    out = []
    for path in sorted(p for p in BANK_DIR.iterdir() if p.is_dir()):
        parts = _bank_paths(path)
        out.append(
            {
                "id": path.name,
                "name": parts["name"],
                "language": parts["language"],
                "license": parts["license"],
                # Reported rather than hidden: a half-installed bank should be a
                # diagnosable problem, not a voice that mysteriously vanished.
                "renderable": bool(parts["acoustic"] and parts["vocoder"]),
            }
        )
    return out


def load_phoneme_map(path: Path, parts: dict) -> Dict[str, int]:
    """Phoneme -> token id. dsconfig's ordered list is authoritative when present."""
    if parts.get("phonemes"):
        listed = parts["phonemes"]
        if isinstance(listed, str):
            f = path / listed
            listed = (
                f.read_text(encoding="utf-8").split()
                if f.exists()
                else [p.strip() for p in listed.split(",")]
            )
        return {p: i for i, p in enumerate(listed)}
    return {}


def load_dictionary(file: Optional[Path]) -> Dict[str, List[str]]:
    """Grapheme -> phonemes, tab or whitespace separated ('twin\tt w ih n')."""
    if not file or not file.exists():
        return {}
    table = {}
    for line in file.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.replace("\t", " ").split()
        if len(parts) >= 2:
            table[parts[0].lower()] = parts[1:]
    return table


def get_bank(bank_id: str) -> dict:
    if bank_id in _sessions:
        return _sessions[bank_id]

    path = BANK_DIR / bank_id
    if not path.is_dir():
        raise FileNotFoundError(f"voicebank '{bank_id}' is not installed")

    parts = _bank_paths(path)
    if not parts["acoustic"] or not parts["vocoder"]:
        raise FileNotFoundError(
            f"voicebank '{bank_id}' is missing acoustic.onnx and/or vocoder.onnx"
        )

    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 2
    bank = {
        "acoustic": ort.InferenceSession(str(parts["acoustic"]), opts, providers=["CPUExecutionProvider"]),
        "vocoder": ort.InferenceSession(str(parts["vocoder"]), opts, providers=["CPUExecutionProvider"]),
        "phoneme_map": load_phoneme_map(path, parts),
        "dictionary": load_dictionary(parts["dictionary"]),
        "sample_rate": parts["sample_rate"],
        "hop_size": parts["hop_size"],
    }
    _sessions[bank_id] = bank
    return bank


# ----------------------------------------------------------------------------- score


def phonemize(syllable: str, bank: dict) -> List[str]:
    """
    Syllable -> phonemes via the bank's own dictionary.

    Unknown syllables fall back to the bare lowercase text: many banks key on
    syllables directly, and refusing to sing a word that is simply absent from the
    dictionary would be a worse failure than attempting it.
    """
    word = syllable.strip().lower()
    if not word or word == "-":
        return []
    return bank["dictionary"].get(word, [word])


def build_frames(notes: List[dict], bpm: float, bank: dict):
    """
    Turn the authored score into token / duration / f0 arrays.

    A '-' syllable HOLDS the previous one: that is how a melisma (one word sung
    across several notes) is written, and treating it as a new word would re-attack
    the consonant on every note.
    """
    sr = bank["sample_rate"]
    hop = bank["hop_size"]
    frames_per_beat = (60.0 / bpm) * sr / hop

    tokens: List[int] = []
    durations: List[int] = []
    f0_frames: List[float] = []
    unknown: List[str] = []

    pmap = bank["phoneme_map"]

    for note in notes:
        frames = max(1, int(round(float(note["beats"]) * frames_per_beat)))
        hz = 440.0 * (2.0 ** ((float(note["midi"]) - 69.0) / 12.0))
        f0_frames.extend([hz] * frames)

        phones = phonemize(note.get("syllable", ""), bank)
        if not phones:
            # Held note: extend the previous phoneme instead of starting a new one.
            if durations:
                durations[-1] += frames
                continue
            phones = ["SP"]  # leading hold has nothing to extend — sing silence

        # Split the note's frames across its phonemes, remainder on the vowel-ish
        # tail so the sustained part of the syllable carries the length.
        each = max(1, frames // len(phones))
        for i, ph in enumerate(phones):
            token = pmap.get(ph)
            if token is None:
                token = pmap.get("SP", 0)
                if ph not in unknown:
                    unknown.append(ph)
            tokens.append(token)
            durations.append(frames - each * (len(phones) - 1) if i == len(phones) - 1 else each)

    return (
        np.array([tokens], dtype=np.int64),
        np.array([durations], dtype=np.int64),
        np.array([f0_frames], dtype=np.float32),
        unknown,
    )


def feed(session, candidates: dict) -> dict:
    """
    Match our arrays to whatever the bank's model actually named its inputs.

    Banks vary in export naming ('tokens' vs 'phoneme', 'durations' vs 'ph_dur'),
    so inputs are bound by name with aliases rather than by position — a positional
    bind would feed durations into the f0 slot on half the banks and produce
    confident garbage instead of an error.
    """
    aliases = {
        "tokens": ["tokens", "phoneme", "ph_seq", "text"],
        "durations": ["durations", "ph_dur", "durs", "dur"],
        "f0": ["f0", "f0_seq", "pitch"],
        "mel": ["mel", "mel_spec", "spectrogram", "c"],
    }
    bound = {}
    for inp in session.get_inputs():
        for key, names in aliases.items():
            if inp.name in names and key in candidates:
                bound[inp.name] = candidates[key]
                break
        else:
            # Optional knobs (speedup, depth, expression curves) get a benign
            # default so a bank that exports them still runs.
            if inp.name in ("speedup", "steps", "depth"):
                bound[inp.name] = np.array(1, dtype=np.int64)
    return bound


# ----------------------------------------------------------------------------- render


class RenderRequest(BaseModel):
    voicebank: str
    bpm: float = 120.0
    notes: List[dict] = []


def _run(job_id: str, req: RenderRequest):
    try:
        JOBS[job_id]["status"] = "processing"
        bank = get_bank(req.voicebank)

        tokens, durations, f0, unknown = build_frames(req.notes, req.bpm, bank)
        if tokens.size == 0:
            raise ValueError("score contained no singable notes")

        acoustic_out = bank["acoustic"].run(
            None, feed(bank["acoustic"], {"tokens": tokens, "durations": durations, "f0": f0})
        )
        mel = acoustic_out[0]

        wave = bank["vocoder"].run(None, feed(bank["vocoder"], {"mel": mel, "f0": f0}))[0]
        audio = np.asarray(wave, dtype=np.float32).squeeze()

        # Guard against clipping without changing the performance: peak-normalize
        # only when the render actually exceeds full scale.
        peak = float(np.max(np.abs(audio))) if audio.size else 0.0
        if peak > 1.0:
            audio = audio / peak

        path = OUT / f"{job_id}.wav"
        sf.write(str(path), audio, bank["sample_rate"])

        JOBS[job_id].update(
            status="completed",
            audio_url=f"/outputs/{path.name}",
            sample_rate=bank["sample_rate"],
            voicebank=req.voicebank,
            duration_seconds=round(len(audio) / bank["sample_rate"], 2),
            # Surfaced so a creator learns their bank has no entry for a syllable,
            # rather than wondering why one word sounds wrong.
            unknown_phonemes=unknown,
        )
    except Exception as exc:  # reported verbatim: the message names the real fault
        JOBS[job_id].update(status="failed", error=f"{type(exc).__name__}: {exc}")


@app.get("/health")
def health():
    banks = list_banks()
    return {
        "ok": True,
        "engine": "diffsinger",
        "voicebank_dir": str(BANK_DIR),
        "installed": len(banks),
        "renderable": len([b for b in banks if b["renderable"]]),
        "loaded": list(_sessions.keys()),
        "queued": len([j for j in JOBS.values() if j["status"] == "queued"]),
    }


@app.get("/voicebanks")
def voicebanks():
    return {"voicebanks": list_banks()}


@app.post("/render")
def render(req: RenderRequest):
    if not req.voicebank:
        return {"error": "voicebank is required"}
    if not req.notes:
        return {"error": "notes are required"}
    job_id = uuid.uuid4().hex
    JOBS[job_id] = {"status": "queued"}
    POOL.submit(_run, job_id, req)
    return {"job_id": job_id, "status": "queued", "voicebank": req.voicebank}


@app.get("/status/{job_id}")
def status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        return {"error": "unknown job_id", "status": "failed"}
    return {"job_id": job_id, **job}