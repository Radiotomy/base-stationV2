"""
Sever — BASE Station's own stem separation engine.

Runs HTDemucs 6-source (htdemucs_6s) locally instead of paying a third-party
API per separation. Six stems: drums, bass, other, vocals, guitar, piano.

Design notes that are load-bearing:

* SEPARATION IS ASYNCHRONOUS. A 3-minute track on CPU takes minutes, far past
  any sane HTTP timeout, so /separate returns a job id immediately and the
  caller polls /status. Doing it inline would guarantee gateway timeouts.

* ONE JOB AT A TIME. max_workers=1 is deliberate. Concurrent separations each
  hold a full model + a full audio tensor in RAM, which is exactly how the
  Coda and Siren Song Spaces earn their 'meta tensor' / OOM crashes. Queueing
  is slower but never fails; parallelism here would be a memory bomb.

* MODEL LOADED ONCE, LAZILY. Loading htdemucs_6s costs a weights download and
  ~2GB of RAM. At import time that would fail the Space boot health check; per
  request it would multiply the cost by every job.

* LOW-LEVEL demucs API ON PURPOSE. `demucs.api.Separator` exists only on the
  unreleased branch — on the pinned 4.0.1 release the real entry points are
  get_model + apply_model, so that is what this uses.

* soundfile, NOT torchaudio.save. torchaudio's native backend (torchcodec)
  does not load on the HF Space image — an already-paid-for lesson from Skye.
"""

import os
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, List, Optional

import soundfile as sf
import torch
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

OUT = Path("/tmp/outputs")
OUT.mkdir(parents=True, exist_ok=True)

MODEL_NAME = "htdemucs_6s"

app = FastAPI(title="Sever", description="HTDemucs-6s stem separation")
# Static mount so a finished stem is a plain downloadable URL. The backend
# copies these into Base44 storage — a /tmp file on a sleeping Space is gone.
app.mount("/outputs", StaticFiles(directory=str(OUT)), name="outputs")

JOBS: Dict[str, dict] = {}
POOL = ThreadPoolExecutor(max_workers=1)
_model = None


def get_model_once():
    global _model
    if _model is None:
        from demucs.pretrained import get_model

        m = get_model(MODEL_NAME)
        m.cpu()
        m.eval()
        _model = m
    return _model


class SeparateRequest(BaseModel):
    audio_url: str
    stems: Optional[List[str]] = None


def _run(job_id: str, audio_url: str, want: Optional[List[str]]):
    from demucs.apply import apply_model
    from demucs.audio import AudioFile

    src = OUT / f"{job_id}_src"
    try:
        JOBS[job_id]["status"] = "processing"
        urllib.request.urlretrieve(audio_url, src)

        model = get_model_once()
        wav = AudioFile(str(src)).read(
            streams=0, samplerate=model.samplerate, channels=model.audio_channels
        )

        # Demucs expects the input normalized to zero mean / unit variance, then
        # the same transform undone on the output. Skipping this does not error —
        # it just quietly degrades separation quality.
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / ref.std()

        with torch.no_grad():
            sources = apply_model(model, wav[None], device="cpu", progress=False)[0]
        sources = sources * ref.std() + ref.mean()

        files = {}
        for name, tensor in zip(model.sources, sources):
            if want and name not in want:
                continue
            path = OUT / f"{job_id}_{name}.wav"
            # (channels, samples) -> (samples, channels) for soundfile
            sf.write(str(path), tensor.t().cpu().numpy(), model.samplerate)
            files[name] = f"/outputs/{path.name}"

        JOBS[job_id].update(
            status="completed",
            stems=files,
            sample_rate=model.samplerate,
            model=MODEL_NAME,
        )
    except Exception as exc:  # surfaced to the caller instead of a silent stall
        JOBS[job_id].update(status="failed", error=f"{type(exc).__name__}: {exc}")
    finally:
        if src.exists():
            try:
                os.remove(src)
            except OSError:
                pass


@app.get("/health")
def health():
    return {
        "ok": True,
        "model": MODEL_NAME,
        "stems": list(_model.sources) if _model is not None else None,
        "loaded": _model is not None,
        "queued": len([j for j in JOBS.values() if j["status"] == "queued"]),
    }


@app.post("/separate")
def separate(req: SeparateRequest):
    if not req.audio_url:
        return {"error": "audio_url is required"}
    job_id = uuid.uuid4().hex
    JOBS[job_id] = {"status": "queued", "stems": {}}
    POOL.submit(_run, job_id, req.audio_url, req.stems)
    return {"job_id": job_id, "status": "queued", "model": MODEL_NAME}


@app.get("/status/{job_id}")
def status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        return {"error": "unknown job_id", "status": "failed"}
    return {"job_id": job_id, **job}