# Cadence — chord-conditioned bed engine (HF Space, GPU)
#
# audiocraft pins hard to Torch 2.1.0 + CUDA 12.1. Do NOT float these: a newer
# torch pulls a torchao/transformers combination that raises
# "AttributeError: module torch has no attribute int1" at import, which is the
# exact wall the Coda Space hit.
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive

# pkg-config and the libav* headers are here because audiocraft depends on
# av==11.0.0. If pip cannot match a prebuilt PyAV wheel it builds from source,
# and that build dies with "pkg-config is required for building PyAV" — which is
# how the first build of this Space failed. The ffmpeg binary alone is NOT enough;
# the source build needs the dev headers.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-dev ffmpeg git \
    pkg-config build-essential \
    libavformat-dev libavcodec-dev libavdevice-dev libavutil-dev \
    libavfilter-dev libswscale-dev libswresample-dev \
    && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3 /usr/bin/python

# Ubuntu 22.04 ships pip 22.0.2, which is old enough to miss the manylinux PyAV
# wheel and fall back to a source build. Upgrading pip is the actual fix — the
# dev headers above are the safety net if a wheel still isn't matched.
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir torch==2.1.0 torchaudio==2.1.0 \
      --index-url https://download.pytorch.org/whl/cu121 \
    && pip install --no-cache-dir -r requirements.txt

COPY app.py .

# HF Spaces run as a non-root user with a read-only image layer, so every cache
# and output path must live under /tmp — the same fix Sever needed.
ENV HF_HOME=/tmp/hf \
    TORCH_HOME=/tmp/torch \
    XDG_CACHE_HOME=/tmp/cache \
    PYTHONUNBUFFERED=1

RUN mkdir -p /tmp/outputs /tmp/hf /tmp/torch /tmp/cache

EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]