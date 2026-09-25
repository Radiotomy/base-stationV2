# SheetSage2 — BASE Station's audio → lead sheet / MIDI engine (Hugging Face Space).
#
# Python 3.11 per upstream. Debian bookworm ships FFmpeg 5.1 with shared libs,
# which is inside torchaudio 2.8's supported FFmpeg range (the decoder also falls
# back to the ffmpeg CLI), so audio decoding works without a custom build.
FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg git libsndfile1 build-essential && rm -rf /var/lib/apt/lists/*

# Non-root user: HF Spaces run as uid 1000, and files created as root at build
# time are unwritable at runtime — the classic permission crash.
RUN useradd -m -u 1000 user && mkdir -p /app && chown -R user:user /app
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app

# CUDA 12.6 wheels bundle their own CUDA runtime, so no CUDA base image is needed.
RUN pip install --user torch==2.8.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cu126
RUN pip install --user huggingface-hub==0.36.0 fastapi uvicorn python-multipart

# Model code + adapter weights baked into the image: no per-boot download.
RUN huggingface-cli download m-a-p/SheetSage2 --local-dir SheetSage2
# Installed LAST so upstream's pins win (notably transformers==4.45.2 — a newer
# transformers breaks the model's remote code).
RUN pip install --user -r SheetSage2/requirements.txt

# The pinned MERT-v2 parent the adapters merge into, also baked in at the exact
# revision the model config names, so from_pretrained resolves it offline.
RUN python -c "import json; from huggingface_hub import snapshot_download; c=json.load(open('SheetSage2/config.json')); snapshot_download(c.get('base_model_name_or_path') or 'm-a-p/MERT-v2-FullSong', revision=c.get('base_model_revision'), cache_dir='/app/hf_cache')"

COPY --chown=user app.py .

# Runtime cache for anything not baked in (remote-code modules). app.py verifies
# it is writable and falls back to /tmp/hf_cache when no storage is attached.
ENV HF_HOME=/data/hf_cache

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]