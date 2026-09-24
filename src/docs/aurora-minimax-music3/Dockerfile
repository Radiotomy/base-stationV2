# torch 2.6 is a HARD floor, not a preference. diffusers registers its flash-attn
# dispatch through torch.library.custom_op, whose schema inference on 2.4 cannot
# read PEP-604 annotations ("float | None") — importing the MiniMax-Music3 vocoder
# dies at module load, before any weight is touched. transformers also disables
# its PyTorch backend entirely below 2.5, so 2.4 could never have run this model.
FROM pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    git libsndfile1 ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# HF_HOME must point at a WRITABLE mount. The HF Space root filesystem is
# read-only and HOME is unset at runtime, so huggingface_hub falls back to
# /.cache, hits PermissionError, and cannot download even the
# modular_model_index.json config — which then surfaces as a misleading
# "404 model_index.json" load failure. /data is the persistent mount (already
# used for jobs/outputs) and is writable by the runtime user, so the model
# cache lives there and survives restarts instead of re-streaming ~22GB of
# bf16 weights on every cold start.
ENV HF_XET_HIGH_PERFORMANCE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/data/hf_cache

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]