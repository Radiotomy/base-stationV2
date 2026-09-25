# SheetSage2 — BASE Station's audio → score engine (Hugging Face Space).
#
#   POST /transcribe  multipart `file` OR form `audio_url` (+ optional melody_only)
#                     -> { abc, events, midi (base64), summary, abc_error }
#   GET  /health      -> engine status + model load state
#
# Transcription is synchronous (seconds on a GPU) but SERIAL: one song at a time
# behind a lock — concurrent inference on one GPU is what produced the
# "meta tensor" crashes on our other engines.
#
# The model loads in a background thread so uvicorn binds port 7860 at once;
# a blocking load at import makes the Space startup probe give up.

import os
import json
import base64
import threading
import traceback
import urllib.request
from pathlib import Path
from typing import Optional

import numpy as np
import torch
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

MODEL_ID = "m-a-p/SheetSage2"
MODEL_DIR = os.environ.get("SHEETSAGE_MODEL_DIR", "/app/SheetSage2")
BAKED_CACHE = "/app/hf_cache"  # MERT-v2 parent baked in at build time
MAX_BYTES = 200 * 1024 * 1024


def _resolve_hf_cache():
    """Pick a WRITABLE HF cache: the persistent /data mount when attached, else
    /tmp. The Space root filesystem is read-only for the runtime user, and an
    unwritable HF_HOME fails downloads with misleading 404/permission errors."""
    for cand in ("/data/hf_cache", "/tmp/hf_cache"):
        try:
            os.makedirs(cand, exist_ok=True)
            probe = os.path.join(cand, ".write_probe")
            with open(probe, "w") as f:
                f.write("ok")
            os.remove(probe)
            os.environ["HF_HOME"] = cand
            return cand
        except OSError:
            continue
    return None


HF_CACHE = _resolve_hf_cache()

app = FastAPI(title="SheetSage2 — BASE Station")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
_LOCK = threading.Lock()
MODEL = None
MODEL_STATE = "loading"
MODEL_ERROR = ""


def _load_in_background():
    global MODEL, MODEL_STATE, MODEL_ERROR
    try:
        from transformers import AutoModel
        source = MODEL_DIR if os.path.isfile(os.path.join(MODEL_DIR, "config.json")) else MODEL_ID
        kwargs = {"trust_remote_code": True, "token": os.environ.get("HF_TOKEN")}
        if os.path.isdir(BAKED_CACHE):
            kwargs["cache_dir"] = BAKED_CACHE
        MODEL = AutoModel.from_pretrained(source, **kwargs).eval().to(DEVICE)
        MODEL_STATE = "ready"
    except Exception as e:
        traceback.print_exc()
        # Recorded, not raised: the service stays up so /health can say WHY.
        MODEL_STATE, MODEL_ERROR = "failed", str(e)


threading.Thread(target=_load_in_background, daemon=True).start()


def _jsonable(obj):
    if isinstance(obj, dict):
        return {str(k): _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_jsonable(v) for v in obj]
    if isinstance(obj, (bytes, bytearray)):
        return base64.b64encode(bytes(obj)).decode("ascii")
    if isinstance(obj, np.generic):
        return obj.item()
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if torch.is_tensor(obj):
        return obj.detach().cpu().tolist()
    if isinstance(obj, Path):
        return str(obj)
    return obj


def _lab_text(labs, field):
    if not isinstance(labs, dict):
        return ""
    for key in (f"{field}.lab", field):
        if key in labs:
            val = labs[key]
            return val.decode("utf-8", "ignore") if isinstance(val, (bytes, bytearray)) else str(val)
    return ""


def _intervals(labs, field):
    rows = []
    for line in _lab_text(labs, field).splitlines():
        parts = line.split()
        if len(parts) < 3:
            continue
        try:
            start, end = float(parts[0]), float(parts[1])
        except ValueError:
            continue
        rows.append({"start": round(start, 3), "end": round(end, 3), "label": " ".join(parts[2:])})
    return rows


def _rhythm(labs):
    """Tempo and meter from the decoded beat grid (time, position, num, den)."""
    times, meters = [], {}
    for line in _lab_text(labs, "beat").splitlines():
        parts = line.split()
        try:
            times.append(float(parts[0]))
            if len(parts) >= 4:
                m = f"{int(float(parts[2]))}/{int(float(parts[3]))}"
                meters[m] = meters.get(m, 0) + 1
        except (ValueError, IndexError):
            continue
    tempo = None
    if len(times) > 2:
        period = float(np.median(np.diff(times)))
        if period > 0:
            tempo = round(60.0 / period, 1)
    meter = max(meters, key=meters.get) if meters else None
    return tempo, meter, len(times)


def _summary(result):
    labs = result.get("labs") or {}
    tempo, meter, beats = _rhythm(labs)
    return {
        "keys": _intervals(labs, "key"),
        "chords": _intervals(labs, "chord"),
        "sections": _intervals(labs, "structure"),
        "tempo_bpm": tempo,
        "meter": meter,
        "beat_count": beats,
    }


def _download(url):
    if not url.startswith("https://"):
        raise HTTPException(400, "audio_url must be https")
    req = urllib.request.Request(url, headers={"User-Agent": "BASE-Station-SheetSage2/1.0"})
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
):
    if MODEL_STATE != "ready":
        raise HTTPException(503, f"Engine {MODEL_STATE}" + (f": {MODEL_ERROR}" if MODEL_ERROR else " — try again shortly"))

    if file is not None:
        audio_bytes = await file.read()
    elif audio_url:
        audio_bytes = await run_in_threadpool(_download, audio_url)
    else:
        raise HTTPException(400, "Send an audio file or audio_url")
    if not audio_bytes:
        raise HTTPException(400, "Empty audio")

    def work():
        with _LOCK:
            with torch.no_grad():
                return MODEL.transcribe(audio_bytes, melody_only=melody_only)

    abc_error = None
    try:
        result = await run_in_threadpool(work)
    except Exception as e:
        # Upstream raises when ABC can't be produced but keeps partial results.
        partial = getattr(e, "result", None)
        if partial is None:
            traceback.print_exc()
            raise HTTPException(500, f"Transcription failed: {e}")
        result, abc_error = partial, str(e)

    midi = result.get("midi")
    payload = {
        "abc": result.get("abc") or "",
        "events": result.get("events") or [],
        "midi": base64.b64encode(midi).decode("ascii") if isinstance(midi, (bytes, bytearray)) else None,
        "summary": _summary(result),
        "abc_error": abc_error,
        "model_id": MODEL_ID,
    }
    return JSONResponse(_jsonable(payload))


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_id": MODEL_ID,
        "model_state": MODEL_STATE,
        "model_loaded": MODEL is not None,
        "model_error": MODEL_ERROR,
        "device": DEVICE,
        "hf_cache": HF_CACHE,
        "hf_cache_persistent": HF_CACHE == "/data/hf_cache",
    }