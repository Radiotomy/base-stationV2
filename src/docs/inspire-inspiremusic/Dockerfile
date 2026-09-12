# Inspire (InspireMusic) engine Space — CUDA + conda base, because pynini (a
# WeTextProcessing dependency) cannot be built reliably by pip and has to come
# from conda-forge.
FROM nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/third_party/Matcha-TTS \
    INSPIRE_DATA_DIR=/data

RUN apt-get update && apt-get install -y --no-install-recommends \
      git git-lfs curl ca-certificates ffmpeg sox libsox-dev build-essential \
    && git lfs install \
    && rm -rf /var/lib/apt/lists/*

# Miniconda — pynini only installs cleanly from conda-forge.
RUN curl -fsSL https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -o /tmp/mc.sh \
    && bash /tmp/mc.sh -b -p /opt/conda && rm /tmp/mc.sh
ENV PATH=/opt/conda/bin:$PATH

RUN conda install -y python=3.10 && conda install -y -c conda-forge pynini==2.1.5 && conda clean -afy

WORKDIR /app

# Upstream toolkit, including the Matcha-TTS submodule its yaml configs import.
RUN git clone --recursive https://github.com/QwenAudio/FunMusic.git /tmp/funmusic \
    && cp -r /tmp/funmusic/inspiremusic /app/inspiremusic \
    && cp -r /tmp/funmusic/third_party /app/third_party \
    && cp /tmp/funmusic/setup.py /app/setup.py \
    && rm -rf /tmp/funmusic

RUN pip install --no-cache-dir torch==2.3.1 torchaudio==2.3.1 --index-url https://download.pytorch.org/whl/cu121

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
RUN pip install --no-cache-dir -e /app

# flash-attn is a speed-up, not a requirement — a build failure here must not
# take the whole image down with it.
RUN pip install --no-cache-dir flash-attn==2.6.3 --no-build-isolation || \
    echo "flash-attn unavailable — continuing without it"

COPY app.py /app/app.py

# Checkpoints, jobs and outputs all live on the mounted Storage bucket. Created
# here so the container still starts (degraded) if the mount is missing.
RUN mkdir -p /data/jobs /data/outputs /data/prompts /data/pretrained_models

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860", "--timeout-keep-alive", "600"]