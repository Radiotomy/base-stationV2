# Scribe — BASE Station's audio → lead sheet / MIDI engine (Hugging Face Space).
#
# Built ONLY from permissively licensed components so the output is usable
# commercially (replaces SheetSage2, which is CC-BY-NC-4.0):
#   notes     Spotify Basic Pitch            Apache-2.0
#   beats     CPJKU beat_this                MIT
#   chords    BTC (jayg996/BTC-ISMIR19)      MIT
#   key/form  librosa + our own code         ISC
#   ABC       our own writer (below)
#
#   POST /transcribe  multipart `file` OR form `audio_url` (+ melody_only, title)
#                     -> { abc, midi (base64), summary, abc_error, warnings }
#   GET  /health      -> per-component load state
#
# Same response contract as the SheetSage2 engine it replaces, so the app's
# score view and composition footprint hash need no changes.
#
# CPU-only by design: every component runs in well under real time on CPU, so
# the Space needs no GPU. Work is SERIAL behind a lock.

import io
import os
import sys
import base64
import tempfile
import threading
import traceback
import subprocess
import urllib.request
from types import SimpleNamespace
from typing import Optional

import numpy as np
import librosa
import yaml
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from starlette.concurrency import run_in_threadpool

BTC_DIR = "/app/btc"
MAX_BYTES = 200 * 1024 * 1024
MAX_SECONDS = 15 * 60
ENGINE_ID = "scribe-v1"
COMPONENTS = "basic-pitch 0.4.0 (Apache-2.0) + beat_this final0 (MIT) + BTC large-voca (MIT) + librosa (ISC)"

app = FastAPI(title="Scribe — BASE Station")
_LOCK = threading.Lock()
STATE = {"basic_pitch": "loading", "beat_this": "loading", "btc": "loading"}
ERRORS = {}
M = {}


# ── Component loading (background, so port 7860 binds at once) ───────────────
def _load(name, fn):
    try:
        fn()
        STATE[name] = "ready"
    except Exception as e:
        traceback.print_exc()
        STATE[name], ERRORS[name] = "failed", str(e)


def _load_basic_pitch():
    from basic_pitch import ICASSP_2022_MODEL_PATH
    from basic_pitch.inference import Model
    M["bp"] = Model(ICASSP_2022_MODEL_PATH)


def _load_beat_this():
    from beat_this.inference import File2Beats
    M["beats"] = File2Beats(checkpoint_path="final0", device="cpu", dbn=False)


def _load_btc():
    import torch
    # BTC predates NumPy 1.20 and uses the removed np.float / np.int aliases.
    for alias, typ in (("float", float), ("int", int)):
        if not hasattr(np, alias):
            setattr(np, alias, typ)
    sys.path.insert(0, BTC_DIR)
    from btc_model import BTC_model
    from utils.mir_eval_modules import audio_file_to_features, idx2voca_chord
    # Parsed here rather than via upstream HParams, which calls yaml.load
    # without a Loader and fails on PyYAML 6.
    with open(os.path.join(BTC_DIR, "run_config.yaml")) as f:
        cfg = yaml.safe_load(f)
    cfg["feature"]["large_voca"] = True
    cfg["model"]["num_chords"] = 170
    config = SimpleNamespace(**cfg)
    model = BTC_model(config=config.model)
    ckpt = torch.load(os.path.join(BTC_DIR, "test", "btc_model_large_voca.pt"), map_location="cpu", weights_only=False)
    model.load_state_dict(ckpt["model"])
    model.eval()
    M["btc"] = dict(model=model, mean=ckpt["mean"], std=ckpt["std"], config=config,
                    features=audio_file_to_features, vocab=idx2voca_chord())


def _load_all():
    _load("basic_pitch", _load_basic_pitch)
    _load("beat_this", _load_beat_this)
    _load("btc", _load_btc)


threading.Thread(target=_load_all, daemon=True).start()


# ── Analysis stages ──────────────────────────────────────────────────────────
def detect_beats(wav, y, sr, warnings):
    if STATE["beat_this"] == "ready":
        beats, downbeats = M["beats"](wav)
        return np.asarray(beats, float), np.asarray(downbeats, float)
    warnings.append("beat_this unavailable — used librosa beat tracking, no downbeats")
    _, frames = librosa.beat.beat_track(y=y, sr=sr)
    return librosa.frames_to_time(frames, sr=sr), np.array([])


def detect_chords(wav, warnings):
    if STATE["btc"] != "ready":
        warnings.append("chord model unavailable — no chords")
        return []
    import torch
    b = M["btc"]
    feat, per_sec, _ = b["features"](wav, b["config"])
    feat = (feat.T - b["mean"]) / b["std"]
    T = b["config"].model["timestep"]
    n = feat.shape[0]
    feat = np.pad(feat, ((0, (-n) % T), (0, 0)))
    preds = []
    with torch.no_grad():
        x = torch.tensor(feat, dtype=torch.float32).unsqueeze(0)
        for t in range(feat.shape[0] // T):
            out, _ = b["model"].self_attn_layers(x[:, t * T:(t + 1) * T, :])
            p, _ = b["model"].output_layer(out)
            preds.extend(p.squeeze(0).tolist())
    preds = preds[:n]
    rows, start = [], 0
    for i in range(1, n + 1):
        if i == n or preds[i] != preds[start]:
            label = b["vocab"][int(preds[start])]
            if label not in ("N", "X"):
                rows.append({"start": round(start * per_sec, 3), "end": round(i * per_sec, 3), "label": label})
            start = i
    return rows


MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
MAJOR_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
MINOR_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"]


def detect_key(y, sr):
    """Krumhansl–Schmuckler over the harmonic component's mean chroma."""
    chroma = librosa.feature.chroma_cqt(y=librosa.effects.harmonic(y), sr=sr).mean(axis=1)
    best = max(((np.corrcoef(chroma, np.roll(prof, t))[0, 1], t, mode)
                for mode, prof in (("major", MAJOR), ("minor", MINOR)) for t in range(12)))
    _, tonic, mode = best
    return tonic, mode, f"{(MAJOR_NAMES if mode == 'major' else MINOR_NAMES)[tonic]} {mode}"


def detect_sections(y, sr, beats, duration):
    """Beat-synchronous agglomerative segmentation; repeated material shares a
    letter (A, B, C…). Labels describe similarity, not verse/chorus function."""
    hop = 512
    feat = np.vstack([librosa.util.normalize(librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)),
                      librosa.util.normalize(librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop))])
    bounds = librosa.util.fix_frames(librosa.time_to_frames(beats, sr=sr, hop_length=hop), x_min=0, x_max=feat.shape[1])
    sync = librosa.util.sync(feat, bounds, aggregate=np.median, pad=False)
    if sync.shape[1] < 4:
        return [{"start": 0.0, "end": round(duration, 3), "label": "A"}]
    k = int(min(max(round(duration / 20), 3), 10, sync.shape[1] - 1))
    seg = librosa.segment.agglomerative(sync, k)
    col_times = librosa.frames_to_time(bounds[:-1], sr=sr, hop_length=hop)
    starts = [float(col_times[i]) for i in seg]
    ends = starts[1:] + [duration]
    means = np.array([sync[:, a:b].mean(axis=1) for a, b in zip(seg, list(seg[1:]) + [sync.shape[1]])])
    from scipy.cluster.hierarchy import linkage, fcluster
    ids = fcluster(linkage(means, "average", metric="cosine"), t=min(4, len(means)), criterion="maxclust") \
        if len(means) > 1 else [1]
    letters, out = {}, []
    for s, e, c in zip(starts, ends, ids):
        letters.setdefault(c, chr(ord("A") + len(letters)))
        out.append({"start": round(s, 3), "end": round(e, 3), "label": letters[c]})
    return out


def melody_grid(notes, beats):
    """Skyline melody on a sixteenth-note grid derived from the beat grid."""
    cells = []
    for b0, b1 in zip(beats[:-1], beats[1:]):
        step = (b1 - b0) / 4
        for s in range(4):
            t = b0 + s * step
            mid = t + step / 2
            best = None
            for idx, (ns, ne, p, amp, _) in enumerate(notes):
                if 48 <= p <= 88 and amp >= 0.25 and ((ns <= mid < ne) or (t <= ns < t + step)):
                    if best is None or p > best[0]:
                        best = (int(p), idx)
            cells.append((t, t + step, best))
    return cells


# ── ABC writer ───────────────────────────────────────────────────────────────
SHARP_ORDER, FLAT_ORDER = "FCGDAEB", "BEADGCF"
MAJOR_SIG = {0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1}
NATURAL = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
VALID = [16, 12, 8, 6, 4, 3, 2, 1]
QUAL = {"maj": "", "min": "m", "dim": "dim", "aug": "+", "min6": "m6", "maj6": "6", "min7": "m7",
        "minmaj7": "mM7", "maj7": "maj7", "7": "7", "dim7": "dim7", "hdim7": "m7b5", "sus2": "sus2", "sus4": "sus4"}


def chord_symbol(label):
    root, _, q = label.partition(":")
    return root + QUAL.get(q or "maj", q)


def key_signature(tonic, mode):
    n = MAJOR_SIG[(tonic + 3) % 12 if mode == "minor" else tonic]
    sig = {l: 0 for l in NATURAL}
    for l in (SHARP_ORDER[:n] if n > 0 else FLAT_ORDER[:-n]):
        sig[l] = 1 if n > 0 else -1
    return sig, n < 0


def spell(p, sig, flat_key):
    pc = p % 12
    opts = [(l, a) for l in NATURAL for a in (-1, 0, 1) if (NATURAL[l] + a) % 12 == pc]
    diatonic = [o for o in opts if sig[o[0]] == o[1]]
    if diatonic:
        return diatonic[0]
    pref = -1 if flat_key else 1
    return next((o for o in opts if o[1] == 0), None) or next((o for o in opts if o[1] == pref), opts[0])


def abc_pitch(p, sig, flat_key, bar_state):
    letter, alter = spell(p, sig, flat_key)
    octave = (p - alter) // 12 - 1
    acc = ""
    key = (letter, octave)
    if bar_state.get(key, sig[letter]) != alter:
        acc = {1: "^", -1: "_", 0: "="}[alter]
        bar_state[key] = alter
    name = letter if octave <= 4 else letter.lower()
    marks = "," * (4 - octave) if octave < 4 else "'" * (octave - 5) if octave > 5 else ""
    return acc + name + marks


def split_len(n):
    parts = []
    while n > 0:
        v = next(v for v in VALID if v <= n)
        parts.append(v)
        n -= v
    return parts


def build_abc(cells, beats, downbeats, chords, tonic, mode, tempo, bpb, title):
    sig, flat_key = key_signature(tonic, mode)
    first = 0
    if len(downbeats):
        first = int(np.argmin(np.abs(beats - downbeats[0]))) % bpb
    per_bar = bpb * 4
    bars, i = [], 0
    if first:
        bars.append(cells[: first * 4])
        i = first * 4
    while i < len(cells):
        bars.append(cells[i:i + per_bar])
        i += per_bar

    def nid_of(cell):
        return cell[2][1] if cell[2] else None

    def chord_at(t):
        return next((chord_symbol(c["label"]) for c in chords if c["start"] <= t < c["end"]), None)

    body, last_chord = [], None
    for bi, bar in enumerate(bars):
        bar_state, tokens, j = {}, [], 0
        while j < len(bar):
            nid = nid_of(bar[j])
            here = chord_at(bar[j][0])
            k = j + 1
            # A group ends when the note changes, or on a beat where the chord
            # changes (so the chord symbol has a note to sit on).
            while k < len(bar) and nid_of(bar[k]) == nid and not (k % 4 == 0 and chord_at(bar[k][0]) != here):
                k += 1
            sym = chord_at(bar[j][0]) if j % 4 == 0 else None
            prefix = f'"{sym}"' if sym and sym != last_chord else ""
            if sym:
                last_chord = sym
            pitch = abc_pitch(bar[j][2][0], sig, flat_key, bar_state) if nid is not None else "z"
            parts = split_len(k - j)
            tie_next = nid is not None and (
                (k < len(bar) and nid_of(bar[k]) == nid) or
                (k == len(bar) and bi + 1 < len(bars) and bars[bi + 1] and nid_of(bars[bi + 1][0]) == nid))
            for pi, n in enumerate(parts):
                tie = "-" if nid is not None and (pi < len(parts) - 1 or tie_next) else ""
                tokens.append((prefix if pi == 0 else "") + pitch + (str(n) if n != 1 else "") + tie)
            j = k
        body.append(" ".join(tokens))
    lines = [" | ".join(body[i:i + 4]) + " |" for i in range(0, len(body), 4)]
    key_name = (MAJOR_NAMES if mode == "major" else MINOR_NAMES)[tonic] + ("m" if mode == "minor" else "")
    header = [f"X:1", f"T:{title or 'Transcription'}", f"M:{bpb}/4" if bpb != 6 else "M:6/8", "L:1/16"]
    if tempo:
        header.append(f"Q:1/4={int(round(tempo))}")
    header.append(f"K:{key_name}")
    return "\n".join(header + lines) + "\n"


def melody_midi(cells, tempo):
    import pretty_midi
    pm = pretty_midi.PrettyMIDI(initial_tempo=float(tempo or 120))
    inst = pretty_midi.Instrument(program=0, name="Melody")
    cur = None
    for t0, t1, c in cells + [(None, None, None)]:
        if cur and (c is None or c[1] != cur[2]):
            inst.notes.append(pretty_midi.Note(velocity=90, pitch=cur[0], start=cur[1], end=cur[3]))
            cur = None
        if c and cur is None:
            cur = [c[0], t0, c[1], t1]
        elif c and cur:
            cur[3] = t1
    pm.instruments.append(inst)
    return pm


def analyse(wav, melody_only, title):
    warnings = []
    y, sr = librosa.load(wav, sr=22050, mono=True)
    duration = len(y) / sr
    if duration > MAX_SECONDS:
        raise HTTPException(413, "Tracks longer than 15 minutes are not supported")
    beats, downbeats = detect_beats(wav, y, sr, warnings)
    if len(beats) < 4:
        raise HTTPException(422, "No steady beat found — this track can't be notated")
    tempo = round(60.0 / float(np.median(np.diff(beats))), 1)
    bpb = 4
    if len(downbeats) > 2:
        counts = [int(np.sum((beats >= a - 0.05) & (beats < b - 0.05))) for a, b in zip(downbeats[:-1], downbeats[1:])]
        vals, freq = np.unique([c for c in counts if 2 <= c <= 7] or [4], return_counts=True)
        bpb = int(vals[np.argmax(freq)])
    meter = "6/8" if bpb == 6 else f"{bpb}/4"

    tonic, mode, key_label = detect_key(y, sr)
    chords = detect_chords(wav, warnings)
    sections = detect_sections(y, sr, beats, duration)

    notes, full_midi = [], None
    if STATE["basic_pitch"] == "ready":
        from basic_pitch.inference import predict
        _, full_midi, notes = predict(wav, M["bp"])
    else:
        warnings.append("note model unavailable — no melody")
    cells = melody_grid(notes, beats)

    abc, abc_error = "", None
    try:
        abc = build_abc(cells, beats, downbeats, chords, tonic, mode, tempo, bpb, title)
    except Exception as e:
        traceback.print_exc()
        abc_error = f"Lead sheet could not be written: {e}"

    midi_obj = melody_midi(cells, tempo) if (melody_only or full_midi is None) else full_midi
    buf = io.BytesIO()
    midi_obj.write(buf)

    return {
        "abc": abc,
        "abc_error": abc_error,
        "midi": base64.b64encode(buf.getvalue()).decode("ascii"),
        "summary": {
            "keys": [{"start": 0.0, "end": round(duration, 3), "label": key_label}],
            "chords": chords,
            "sections": sections,
            "tempo_bpm": tempo,
            "meter": meter,
            "beat_count": int(len(beats)),
        },
        "warnings": warnings,
        "model_id": ENGINE_ID,
        "components": COMPONENTS,
    }


# ── HTTP ─────────────────────────────────────────────────────────────────────
def _download(url):
    if not url.startswith("https://"):
        raise HTTPException(400, "audio_url must be https")
    req = urllib.request.Request(url, headers={"User-Agent": "BASE-Station-Scribe/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "audio file too large")
    return data


@app.post("/transcribe")
async def transcribe(
    file: Optional[UploadFile] = File(None),
    audio_url: Optional[str] = Form(None),
    melody_only: bool = Form(False),
    title: Optional[str] = Form(None),
):
    if "loading" in STATE.values():
        raise HTTPException(503, "Engine warming up — try again shortly")
    if STATE["basic_pitch"] != "ready" and STATE["btc"] != "ready":
        raise HTTPException(503, f"Engine failed to load: {ERRORS}")

    if file is not None:
        audio_bytes = await file.read()
    elif audio_url:
        audio_bytes = await run_in_threadpool(_download, audio_url)
    else:
        raise HTTPException(400, "Send an audio file or audio_url")
    if not audio_bytes:
        raise HTTPException(400, "Empty audio")

    def work():
        with _LOCK, tempfile.TemporaryDirectory() as d:
            src, wav = os.path.join(d, "in"), os.path.join(d, "audio.wav")
            with open(src, "wb") as f:
                f.write(audio_bytes)
            # One decode for every stage: MP3/FLAC/M4A all become 44.1k WAV.
            r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-ac", "2", "-ar", "44100", wav],
                               capture_output=True)
            if r.returncode != 0:
                raise HTTPException(400, "Could not decode audio")
            return analyse(wav, melody_only, (title or "").strip()[:120])

    try:
        return await run_in_threadpool(work)
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Transcription failed: {e}")


@app.get("/health")
def health():
    return {"status": "ok", "engine": ENGINE_ID, "components": COMPONENTS, "state": STATE, "errors": ERRORS}