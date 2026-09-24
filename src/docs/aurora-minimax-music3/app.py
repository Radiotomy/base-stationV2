# Aurora — BASE Station's MiniMax-Music3 engine (Hugging Face Space).
#
# Runs MiniMaxAI/MiniMax-Music3 through the diffusers ModularPipeline. Contract is
# deliberately identical in shape to our Coda / Siren Song / Skye engines so the
# backend polling, restart handling and health checks are shared:
#
#   POST /generate       { prompt, lyrics, duration, max_new_tokens, seed } -> { task_id, status }
#   GET  /status/{id}    -> { status, progress, result_url?, filename? }
#   GET  /outputs/{file} -> rendered WAV
#   GET  /engine/health  -> persistence report
#
# PERSISTENCE-FIRST: job records are written to disk BEFORE the render starts and
# updated in place, and outputs are written to the same persistent mount. An
# in-memory job table loses every in-flight render on a container restart, which
# is exactly the failure that left jobs spinning forever.
#
# SERIAL QUEUE: one render at a time. Concurrent requests on a single GPU produce
# "Cannot copy out of meta tensor" failures, so the lock is load-bearing.

import os
import json
import uuid
import time
import datetime
import threading
import traceback

import torch
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from diffusers import ModularPipeline

MODEL_ID = os.environ.get("AURORA_MODEL_ID", "MiniMaxAI/MiniMax-Music3")

MIN_SECS, MAX_SECS = 30.0, 300.0
FRAMES_PER_SECOND = 25  # MiniMax emits audio frames at 25 fps


def _writable_dir(preferred, fallback):
    """Use the persistent mount when it is actually writable, else fall back.

    A Space with no bucket attached must still run — it just loses jobs across a
    restart, and /engine/health is what makes that visible instead of silent.
    """
    try:
        os.makedirs(preferred, exist_ok=True)
        probe = os.path.join(preferred, ".write_probe")
        with open(probe, "w") as f:
            f.write("ok")
        os.remove(probe)
        return preferred, True
    except OSError:
        os.makedirs(fallback, exist_ok=True)
        return fallback, False


STATE_DIR, STATE_PERSISTENT = _writable_dir("/data/jobs", "/tmp/jobs")
OUTPUT_DIR, OUTPUT_PERSISTENT = _writable_dir("/data/outputs", "/tmp/outputs")

app = FastAPI(title="Aurora — MiniMax-Music3")
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
_LOCK = threading.Lock()
PIPE = None
SAMPLE_RATE = 32000
# Why the model load is not at import: pulling ~22GB of bf16 weights takes many
# minutes, and uvicorn cannot bind port 7860 until import finishes. The Space's
# startup probe gives up long before that and reports the container as failed —
# so the load runs in a background thread and the port opens immediately.
MODEL_STATE = "loading"
MODEL_ERROR = ""


# ── Durable job records ──────────────────────────────────────────────────────
def _job_path(job_id):
    return os.path.join(STATE_DIR, f"{job_id}.json")


def write_job(job_id, **fields):
    """Read-modify-write a job record. Atomic via rename so a crash mid-write
    can never leave a half-parsed record that reads as a corrupt job."""
    record = read_job(job_id) or {"job_id": job_id, "created_at": time.time()}
    record.update(fields)
    tmp = _job_path(job_id) + ".tmp"
    with open(tmp, "w") as f:
        json.dump(record, f)
    os.replace(tmp, _job_path(job_id))
    return record


def read_job(job_id):
    try:
        with open(_job_path(job_id)) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


# ── Model ────────────────────────────────────────────────────────────────────
def load_model():
    """Loaded once, in the background — a per-request load would re-stream ~11B params."""
    global PIPE, SAMPLE_RATE
    if PIPE is not None:
        return PIPE
    # Authenticated: an anonymous pull of this many files is rate-limited and
    # frequently dies partway, which looks identical to a broken build.
    pipe = ModularPipeline.from_pretrained(MODEL_ID, token=os.environ.get("HF_TOKEN"))
    pipe.load_components(dtype=torch.bfloat16)
    # Explicit .to(DEVICE): the meta-tensor errors our other engines hit came
    # from relying on implicit placement.
    pipe.to(DEVICE)
    SAMPLE_RATE = getattr(pipe, "sampling_rate", 32000)
    PIPE = pipe
    return PIPE


def _load_in_background():
    global MODEL_STATE, MODEL_ERROR
    try:
        load_model()
        MODEL_STATE = "ready"
    except Exception as e:
        traceback.print_exc()
        # Recorded rather than raised: a failed load must leave the service up so
        # /engine/health can say WHY, instead of the container dying silently.
        MODEL_STATE, MODEL_ERROR = "failed", str(e)


# Resolve a writable HF cache dir BEFORE the background load runs. The HF Space
# root filesystem is read-only and HOME is unset at runtime, so huggingface_hub's
# default /.cache is unwritable — which silently kills the modular_model_index
# download and surfaces as a misleading "404 model_index.json" load failure.
# Prefer the persistent /data mount (weights survive restarts); fall back to
# ephemeral /tmp (re-downloads on cold start) when no storage bucket is attached.
# Setting os.environ here is honoured by huggingface_hub, which reads HF_HOME
# lazily at download time rather than at import.
def _resolve_hf_cache():
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


_resolve_hf_cache()

threading.Thread(target=_load_in_background, daemon=True).start()


class GenReq(BaseModel):
    prompt: str
    lyrics: str = ""
    duration: float = 120.0
    max_new_tokens: int | None = None
    seed: int | None = None
    response_format: str = "wav"


def render(job_id, req):
    try:
        write_job(job_id, status="processing", progress="Waiting for the GPU…")
        duration = max(MIN_SECS, min(float(req.duration), MAX_SECS))

        # An empty lyric field is an INSTRUMENTAL request. MiniMax reads the
        # section tags as written, so a bare structure skeleton is how you ask for
        # a song with no sung lines — an empty string would leave the model with
        # no structural guidance at all.
        lyrics = (req.lyrics or "").strip()
        if not lyrics:
            lyrics = "[Intro]\n[Instrumental]\n[Solo]\n[Instrumental]\n[Outro]"

        with _LOCK:
            # Weights may still be streaming on a cold container. Waiting inside
            # the lock keeps the job queued rather than failing it for a reason
            # that resolves itself in a few minutes.
            waited = 0
            while MODEL_STATE == "loading" and waited < 1800:
                write_job(job_id, progress="Engine warming up…")
                time.sleep(10)
                waited += 10
            if MODEL_STATE != "ready":
                raise RuntimeError(f"Engine unavailable: {MODEL_ERROR or 'model still loading'}")
            write_job(job_id, progress="Composing…")
            generator = None
            if req.seed is not None:
                generator = torch.Generator(DEVICE).manual_seed(int(req.seed))

            kwargs = {
                "prompt": req.prompt,
                "lyrics": lyrics,
                "audio_duration": float(duration),
                "output": "audios",
            }
            if generator is not None:
                kwargs["generator"] = generator
            if req.max_new_tokens:
                kwargs["max_new_tokens"] = int(req.max_new_tokens)
            else:
                kwargs["max_new_tokens"] = int(duration * FRAMES_PER_SECOND)

            with torch.inference_mode():
                audio = PIPE(**kwargs)[0]

        write_job(job_id, progress="Writing WAV…")
        stamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"aurora_{stamp}_{job_id[:8]}.wav"
        path = os.path.join(OUTPUT_DIR, filename)
        # 16-bit PCM, never MP3: BASE Mark's forensic layer embeds into PCM, and
        # marking a lossy file destroys the mark.
        sf.write(path, audio.T.float().cpu().numpy(), SAMPLE_RATE, subtype="PCM_16")

        write_job(
            job_id, status="completed", progress="Generation complete",
            filename=filename, result_url=f"/outputs/{filename}",
            sample_rate=SAMPLE_RATE, duration=duration,
        )
    except Exception as e:
        traceback.print_exc()
        write_job(job_id, status="failed", progress="Failed", error=str(e))


def _recover_interrupted_jobs():
    """A container restart kills every render thread, but the job records survive
    on /data — left alone they read 'processing' forever. Re-queue any job that
    stored its request; fail the rest with a clear reason so the poller resolves."""
    try:
        names = [f for f in os.listdir(STATE_DIR) if f.endswith(".json")]
    except OSError:
        return
    for name in names:
        job = read_job(name[:-5])
        if not job or job.get("status") not in ("queued", "processing"):
            continue
        req = job.get("request")
        if req:
            write_job(job["job_id"], status="queued", progress="Re-queued after engine restart")
            threading.Thread(target=render, args=(job["job_id"], GenReq(**req)), daemon=True).start()
        else:
            write_job(job["job_id"], status="failed", progress="Failed",
                      error="Engine restarted mid-render — please generate again.")


_recover_interrupted_jobs()


@app.post("/generate")
def generate(req: GenReq):
    if not (req.prompt or "").strip():
        raise HTTPException(400, "prompt is required")
    job_id = uuid.uuid4().hex
    # Written to durable storage BEFORE the thread starts, so a crash during
    # startup still leaves a record the poller can resolve.
    # The request is stored with the record so a restart can re-run it.
    write_job(job_id, status="queued", progress="Queued", request=req.model_dump())
    threading.Thread(target=render, args=(job_id, req), daemon=True).start()
    return {"task_id": job_id, "job_id": job_id, "status": "queued"}


@app.get("/status/{job_id}")
def status(job_id: str):
    job = read_job(job_id)
    if not job:
        raise HTTPException(404, "unknown job")
    return job


@app.get("/engine/health")
def engine_health():
    try:
        pending = len([f for f in os.listdir(STATE_DIR) if f.endswith(".json")])
    except OSError:
        pending = -1
    return {
        "state_dir": STATE_DIR,
        "state_persistent": STATE_PERSISTENT,
        "output_dir": OUTPUT_DIR,
        "output_persistent": OUTPUT_PERSISTENT,
        "job_records": pending,
        "model_id": MODEL_ID,
        "model_loaded": PIPE is not None,
        "model_state": MODEL_STATE,
        "model_error": MODEL_ERROR,
        "device": DEVICE,
        "sample_rate": SAMPLE_RATE,
    }