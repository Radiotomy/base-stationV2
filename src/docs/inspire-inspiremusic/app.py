# Inspire — BASE Station's InspireMusic engine (Hugging Face Space handler).
#
# Upstream: https://github.com/QwenAudio/FunMusic (FunAudioLLM/InspireMusic),
# Apache-2.0. Audio tokenizer → Qwen2.5-backbone autoregressive transformer →
# flow-matching super-resolution → vocoder. Tasks: text-to-music and
# continuation (audio prompt). Instrumental only; no vocal checkpoint released.
#
# This is NOT the upstream Gradio demo. It follows the same persistence-first
# contract every other BASE engine uses, for reasons learned the hard way:
#
#   1. JOBS ARE PERSISTED BEFORE THEY RUN. The job table lives in /data (a
#      mounted HF Storage bucket), not in memory. A Space restart mid-render must
#      leave a readable 'failed' row rather than a job id the platform polls
#      forever ("unknown job_id" was exactly the Cantor failure mode).
#   2. RENDERS ARE SERIAL. One worker thread, one queue. Concurrent requests each
#      re-entering the model loader is what produces the 'meta tensor' crashes
#      seen on Coda and Siren Song.
#   3. MODELS LOAD ONCE per process and are cached per checkpoint — a 1.5B model
#      reloaded per request cannot finish inside any sane timeout.
#   4. OUTPUTS ARE WRITTEN TO /data/outputs AND SERVED. The platform copies the
#      WAV into its own storage immediately, but the file has to survive long
#      enough to be fetched, which ephemeral /tmp does not guarantee.
#
# HTTP contract consumed by base44/shared/inspireEngine.ts:
#   POST /generate {task, text, audio_prompt_url, chorus, duration,
#                   sample_rate, model, seed} -> {task_id, status}
#   GET  /status/{task_id} -> {status, progress, result_url, error}
#   GET  /outputs/{filename} -> the WAV
#   GET  /health -> {ok, models_cached, queue_depth}

import os, sys, json, uuid, time, threading, queue, traceback
import requests
import torch
import torchaudio
from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.append(f"{ROOT}/third_party/Matcha-TTS")
os.environ.setdefault("PYTHONPATH", "third_party/Matcha-TTS")

# Persistent mount. An ephemeral Space disk loses the job table and every render
# on restart, which is data loss the platform cannot recover from.
DATA_DIR = os.environ.get("INSPIRE_DATA_DIR", "/data")
JOBS_DIR = os.path.join(DATA_DIR, "jobs")
OUT_DIR = os.path.join(DATA_DIR, "outputs")
PROMPT_DIR = os.path.join(DATA_DIR, "prompts")
# Weights live on the CONTAINER disk, not the mount. The mounted volume rejects
# the dot-prefixed temp entries both the ModelScope and HF downloaders create
# (Errno 13 even as uid 0 with a 0777 parent), so a checkpoint can never be
# written there. Jobs and outputs — the data that must survive a restart — stay
# on /data; weights are reproducible and are simply re-fetched on a cold start.
MODEL_ROOT = os.environ.get("INSPIRE_MODEL_ROOT", "/models")
for d in (JOBS_DIR, OUT_DIR, PROMPT_DIR, MODEL_ROOT):
    os.makedirs(d, exist_ok=True)
    # The mount squashes root, so a directory left at 0755 by an earlier
    # container rejects writes even from uid 0 — every path this process must
    # write to is opened up explicitly rather than trusted to be writable.
    try:
        os.chmod(d, 0o777)
    except Exception:
        pass

# Upstream's loader falls back to a modelscope download when a checkpoint folder
# is incomplete, and modelscope writes its scratch dir wherever its cache points.
# Both are pinned into the mount here so a download never lands on a path this
# process cannot write (that is the '._____temp' Permission denied failure).
os.environ.setdefault("MODELSCOPE_CACHE", "/models/.modelscope")
os.environ.setdefault("HF_HOME", "/models/.hf")
os.makedirs(os.environ["MODELSCOPE_CACHE"], exist_ok=True)
os.makedirs(os.environ["HF_HOME"], exist_ok=True)

ALLOWED_MODELS = {
    "InspireMusic-1.5B-Long": 48000,
    "InspireMusic-1.5B": 48000,
    "InspireMusic-Base": 48000,
    "InspireMusic-1.5B-24kHz": 24000,
    "InspireMusic-Base-24kHz": 24000,
}
DEFAULT_MODEL = "InspireMusic-1.5B-Long"
MIN_SECONDS, MAX_SECONDS = 10.0, 300.0
# Upstream trims the audio prompt to 5s; longer prompts are not used by the model.
PROMPT_SECONDS = 5

app = FastAPI()
_model_cache = {}
_cache_lock = threading.Lock()
_work = queue.Queue()


# ── job records on disk ──────────────────────────────────────────────────────
def job_path(task_id):
    return os.path.join(JOBS_DIR, f"{task_id}.json")


def write_job(rec):
    tmp = job_path(rec["task_id"]) + ".tmp"
    with open(tmp, "w") as f:
        json.dump(rec, f)
    os.replace(tmp, job_path(rec["task_id"]))  # atomic: a half-written job is unreadable


def read_job(task_id):
    try:
        with open(job_path(task_id)) as f:
            return json.load(f)
    except Exception:
        return None


def update_job(task_id, **patch):
    rec = read_job(task_id)
    if rec:
        rec.update(patch)
        write_job(rec)
    return rec


# ── model handling ───────────────────────────────────────────────────────────
def ensure_weights(model_name):
    """Download the checkpoint into the persistent mount on first use.

    Uses the hub client rather than `git clone`: a shelled-out clone reports
    nothing on failure, so a partial download looked like a present checkpoint
    and the real error only surfaced later as a write into an unwritable temp dir.
    """
    target = os.path.join(MODEL_ROOT, model_name)
    if os.path.isfile(os.path.join(target, "inspiremusic.yaml")):
        patch_attention(target)
        link_checkpoint(model_name, target)
        return target
    # A leftover folder from an earlier failed attempt is NOT reusable: the
    # partial tree was written by a different attempt and its own permissions
    # then reject the next download's temp files ('._____temp', '.DS_Store'
    # Permission denied), even though the parent mount is writable. Clearing it
    # is what makes a retry actually retry.
    import shutil
    shutil.rmtree(target, ignore_errors=True)
    os.makedirs(target, exist_ok=True)
    os.chmod(target, 0o777)

    # ModelScope is the AUTHORITATIVE source: upstream took the FunAudioLLM
    # checkpoints off Hugging Face, so an HF-first loader 404s on every model.
    # The HF community mirror is kept only as a fallback for the day ModelScope
    # is unreachable, and never as the primary.
    errors = []
    try:
        from modelscope import snapshot_download as ms_download
        ms_download(model_id=f"iic/{model_name}", local_dir=target)
    except Exception as e:
        errors.append(f"modelscope: {type(e).__name__}: {e}")
        try:
            from huggingface_hub import snapshot_download as hf_download
            hf_download(
                repo_id=f"rtikw/{model_name}",
                local_dir=target,
                token=os.environ.get("HF_TOKEN") or None,
            )
        except Exception as e2:
            errors.append(f"hf mirror: {type(e2).__name__}: {e2}")
            raise RuntimeError("checkpoint download failed — " + " | ".join(errors))

    if not os.path.isfile(os.path.join(target, "inspiremusic.yaml")):
        raise RuntimeError(f"{model_name} downloaded without inspiremusic.yaml — incomplete checkpoint")
    # Upstream ships relative paths in the yaml that only resolve from its own
    # examples/ directory — flattened here so the config works from any cwd.
    os.system(f"""cd {target} && sed -i -e "s/\\.\\.\\/\\.\\.\\///g" inspiremusic.yaml""")
    # The published checkpoint asks for flash_attention_2, but flash-attn is an
    # optional build here (it fails to compile on this image often enough that
    # making it required would break the whole engine). PyTorch's own SDPA kernel
    # is numerically equivalent for inference, so the request is rewritten rather
    # than the dependency forced.
    patch_attention(target)
    link_checkpoint(model_name, target)
    return target


def flash_available():
    try:
        import flash_attn  # noqa: F401
        return True
    except Exception:
        return False


def patch_source_attention():
    """Upstream HARDCODES attn_implementation='flash_attention_2' in
    qwen_encoder.py — it is not a config value, so no checkpoint edit can reach
    it. flash-attn is an optional build on this image (it frequently fails to
    compile, and making it mandatory would take the whole engine down), so the
    source request is rewritten to PyTorch's SDPA kernel, which is numerically
    equivalent for inference."""
    if flash_available():
        return
    p = os.path.join(ROOT, "inspiremusic", "transformer", "qwen_encoder.py")
    try:
        with open(p) as f:
            body = f.read()
        if "flash_attention_2" in body:
            with open(p, "w") as f:
                f.write(body.replace("flash_attention_2", "sdpa"))
    except Exception:
        traceback.print_exc()


def patch_attention(target):
    """Rewrite flash_attention_2 requests to sdpa when flash-attn is absent."""
    if flash_available():
        return
    for dirpath, _dirs, files in os.walk(target):
        for fn in files:
            if not fn.endswith((".yaml", ".json")):
                continue
            p = os.path.join(dirpath, fn)
            try:
                with open(p) as f:
                    body = f.read()
                if "flash_attention_2" in body:
                    with open(p, "w") as f:
                        f.write(body.replace("flash_attention_2", "sdpa"))
            except Exception:
                pass


def link_checkpoint(model_name, target):
    """Expose the checkpoint at ./pretrained_models/<name>, relative to cwd.

    Upstream's yaml (and the flattening sed above) leaves RELATIVE paths that the
    transformers loader resolves against the working directory, so a checkpoint
    stored anywhere else is simply not found no matter that it downloaded
    correctly. A symlink satisfies those paths without editing every config.
    """
    link_root = os.path.join(os.getcwd(), "pretrained_models")
    os.makedirs(link_root, exist_ok=True)
    link = os.path.join(link_root, model_name)
    if os.path.islink(link) or os.path.exists(link):
        if os.path.realpath(link) == os.path.realpath(target):
            return
        if os.path.islink(link):
            os.unlink(link)
        else:
            return
    os.symlink(target, link)


def get_model(model_name):
    with _cache_lock:
        if model_name in _model_cache:
            return _model_cache[model_name]
    patch_source_attention()
    from inspiremusic.cli.inference import InspireMusicModel, env_variables
    env_variables()
    model_dir = ensure_weights(model_name)
    out_rate = ALLOWED_MODELS[model_name]
    model = InspireMusicModel(
        model_name=model_name,
        model_dir=model_dir,
        min_generate_audio_seconds=MIN_SECONDS,
        max_generate_audio_seconds=MAX_SECONDS,
        sample_rate=24000,
        output_sample_rate=out_rate,
        load_jit=True,
        load_onnx=False,
        # 24kHz checkpoints have no flow-matching stage — 'fast' is what upstream
        # calls skipping it, so it tracks the checkpoint, never a user preference.
        fast=(out_rate == 24000),
        result_dir=OUT_DIR,
    )
    with _cache_lock:
        _model_cache[model_name] = model
    return model


def fetch_prompt(url, task_id):
    """Download and trim the continuation prompt. The platform sends a URL rather
    than bytes, so the audio never has to be held in a serverless function."""
    dest_raw = os.path.join(PROMPT_DIR, f"{task_id}_raw")
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(dest_raw, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    audio, sr = torchaudio.load(dest_raw)
    trimmed = os.path.join(PROMPT_DIR, f"{task_id}.wav")
    torchaudio.save(trimmed, audio[:, : PROMPT_SECONDS * sr], sr)
    os.remove(dest_raw)
    return trimmed


# ── serial worker ────────────────────────────────────────────────────────────
def worker():
    while True:
        task_id = _work.get()
        rec = read_job(task_id)
        if not rec:
            _work.task_done()
            continue
        try:
            update_job(task_id, status="processing", progress="Loading model…")
            model = get_model(rec["model"])

            prompt_file = None
            if rec["task"] == "continuation":
                update_job(task_id, progress="Preparing audio prompt…")
                prompt_file = fetch_prompt(rec["audio_prompt_url"], task_id)

            update_job(task_id, progress="Running inference…")
            out_fn = task_id
            path = model.inference(
                task=rec["task"],
                text=rec["text"] or None,
                audio_prompt=prompt_file,
                chorus=rec["chorus"],
                time_start=0.0,
                time_end=float(rec["duration"]),
                output_fn=out_fn,
                max_audio_prompt_length=float(PROMPT_SECONDS),
                fade_out_duration=1.0,
                output_format="wav",
                fade_out_mode=True,
                trim=False,
            )
            filename = os.path.basename(path) if path else f"{out_fn}.wav"
            final = os.path.join(OUT_DIR, filename)
            if not os.path.exists(final):
                raise RuntimeError("inference reported success but wrote no file")
            update_job(
                task_id,
                status="completed",
                progress="",
                result_url=f"/outputs/{filename}",
                filename=filename,
                completed_at=time.time(),
            )
        except Exception as e:
            traceback.print_exc()
            update_job(task_id, status="failed", error=f"{type(e).__name__}: {e}", progress="")
        finally:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            _work.task_done()


threading.Thread(target=worker, daemon=True).start()


# Requeue anything left mid-flight by a restart. Re-run rather than fail: the
# creator was already told the render was accepted.
def requeue_orphans():
    for name in os.listdir(JOBS_DIR):
        if not name.endswith(".json"):
            continue
        rec = read_job(name[:-5])
        if rec and rec.get("status") in ("queued", "processing"):
            update_job(rec["task_id"], status="queued", progress="Re-queued after engine restart")
            _work.put(rec["task_id"])


requeue_orphans()


# ── API ──────────────────────────────────────────────────────────────────────
class GenerateRequest(BaseModel):
    task: str = "text-to-music"
    text: str = ""
    audio_prompt_url: str = ""
    chorus: str = "intro"
    duration: float = 60.0
    sample_rate: int = 48000
    model: str = DEFAULT_MODEL
    seed: int | None = None


@app.post("/generate")
def generate(req: GenerateRequest):
    task = req.task if req.task in ("text-to-music", "continuation") else "text-to-music"
    if task == "continuation" and not req.audio_prompt_url:
        return JSONResponse({"error": "continuation requires audio_prompt_url"}, status_code=400)
    if task == "text-to-music" and not req.text.strip():
        return JSONResponse({"error": "text-to-music requires text"}, status_code=400)

    model = req.model if req.model in ALLOWED_MODELS else DEFAULT_MODEL
    duration = max(MIN_SECONDS, min(float(req.duration), MAX_SECONDS))
    chorus = req.chorus if req.chorus in ("intro", "verse", "chorus", "outro") else "intro"
    if req.seed:
        torch.manual_seed(int(req.seed))

    task_id = uuid.uuid4().hex
    write_job({
        "task_id": task_id, "status": "queued", "progress": "Queued",
        "task": task, "text": req.text.strip(), "audio_prompt_url": req.audio_prompt_url,
        "chorus": chorus, "duration": duration, "model": model,
        "seed": req.seed, "created_at": time.time(),
        "result_url": "", "error": "",
    })
    _work.put(task_id)
    return {"task_id": task_id, "status": "queued", "queue_depth": _work.qsize()}


@app.get("/status/{task_id}")
def status(task_id: str):
    rec = read_job(task_id)
    if not rec:
        # 404 is meaningful to the platform: it fails the job instead of polling
        # a render that no longer exists.
        return JSONResponse({"error": "unknown task_id"}, status_code=404)
    return {
        "status": rec.get("status", "queued"),
        "progress": rec.get("progress", ""),
        "result_url": rec.get("result_url", ""),
        "error": rec.get("error", ""),
    }


@app.get("/outputs/{filename}")
def outputs(filename: str):
    safe = os.path.basename(filename)
    path = os.path.join(OUT_DIR, safe)
    if not os.path.exists(path):
        return JSONResponse({"error": "not found"}, status_code=404)
    return FileResponse(path, media_type="audio/wav", filename=safe)


@app.get("/health")
def health():
    return {"ok": True, "models_cached": list(_model_cache.keys()), "queue_depth": _work.qsize()}


@app.get("/diag")
def diag():
    """Mount and identity report. A render that cannot write its checkpoint fails
    minutes into inference, so the writability of every path is checked here up
    front rather than diagnosed from a stack trace."""
    def probe(path):
        try:
            os.makedirs(path, exist_ok=True)
            p = os.path.join(path, ".write_probe")
            with open(p, "w") as f:
                f.write("ok")
            os.remove(p)
            writable = True
            err = ""
        except Exception as e:
            writable, err = False, f"{type(e).__name__}: {e}"
        st = os.stat(path) if os.path.exists(path) else None
        return {
            "writable": writable, "error": err,
            "owner_uid": getattr(st, "st_uid", None),
            "mode": oct(getattr(st, "st_mode", 0) & 0o777),
        }

    return {
        "uid": os.getuid(),
        "gid": os.getgid(),
        "cuda": torch.cuda.is_available(),
        "paths": {p: probe(p) for p in (DATA_DIR, JOBS_DIR, OUT_DIR, MODEL_ROOT, os.environ["MODELSCOPE_CACHE"])},
        "checkpoints_present": sorted(os.listdir(MODEL_ROOT)) if os.path.isdir(MODEL_ROOT) else [],
    }