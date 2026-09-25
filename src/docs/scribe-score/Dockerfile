# Scribe — BASE Station's audio → lead sheet / MIDI engine (Hugging Face Space).
# CPU-only. Python 3.10 so Basic Pitch uses the light tflite runtime instead of
# pulling full TensorFlow (which it requires on 3.11+).
FROM python:3.10-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg git libsndfile1 build-essential && rm -rf /var/lib/apt/lists/*

# HF Spaces run as uid 1000; files created as root at build time are unwritable.
RUN useradd -m -u 1000 user && mkdir -p /app && chown -R user:user /app
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TORCH_HOME=/app/torch_cache
WORKDIR /app

# --extra-index-url (not --index-url): torch's own dependencies must still
# resolve from PyPI — the CPU wheel index alone lacks build tools like flit_core.
RUN pip install --user --upgrade pip && \
    pip install --user torch==2.4.1 torchaudio==2.4.1 --extra-index-url https://download.pytorch.org/whl/cpu
# numpy<2: tflite-runtime is compiled against the numpy 1.x ABI.
RUN pip install --user "numpy<2" fastapi uvicorn python-multipart pyyaml soundfile soxr einops rotary-embedding-torch
RUN pip install --user "basic-pitch==0.4.0" "numpy<2"
RUN pip install --user https://github.com/CPJKU/beat_this/archive/main.zip "numpy<2"

# BTC chord model (MIT) — code and the large-vocabulary checkpoint live in the repo.
RUN git clone --depth 1 https://github.com/jayg996/BTC-ISMIR19 /app/btc

# Bake the beat_this checkpoint into the image: no per-boot download.
RUN python -c "from beat_this.inference import File2Beats; File2Beats(checkpoint_path='final0', device='cpu', dbn=False)"

COPY --chown=user app.py .

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]