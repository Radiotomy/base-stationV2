FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# CPU-only torch. --extra-index-url keeps PyPI reachable: using --index-url
# alone REPLACES PyPI, and every non-torch dependency then fails to resolve
# (the exact failure that broke the first CLAP Space build).
RUN pip install --no-cache-dir "torch==2.4.1" "torchaudio==2.4.1" \
    --index-url https://download.pytorch.org/whl/cpu \
    --extra-index-url https://pypi.org/simple

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Only /tmp and /data are writable on a Space. Model weights and caches must
# be redirected there or the first separation dies on a read-only filesystem.
ENV TORCH_HOME=/tmp/torch \
    XDG_CACHE_HOME=/tmp/cache \
    HF_HOME=/tmp/hf

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]