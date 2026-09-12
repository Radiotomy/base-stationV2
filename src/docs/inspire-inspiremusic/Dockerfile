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

# Miniforge, NOT Miniconda — pynini only installs cleanly from conda-forge, and
# Anaconda's own channels (repo.anaconda.com) now refuse to install until their
# Terms of Service are accepted interactively, which fails every Docker build.
# Miniforge ships conda-forge as its only channel, so the gate never applies.
RUN curl -fsSL https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh -o /tmp/mc.sh \
    && bash /tmp/mc.sh -b -p /opt/conda && rm /tmp/mc.sh
ENV PATH=/opt/conda/bin:$PATH

RUN conda install -y -c conda-forge --override-channels python=3.10 pynini==2.1.5 && conda clean -afy

WORKDIR /app

# Upstream toolkit, including the Matcha-TTS submodule its yaml configs import.
RUN git clone --recursive https://github.com/QwenAudio/FunMusic.git /tmp/funmusic \
    && cp -r /tmp/funmusic/inspiremusic /app/inspiremusic \
    && cp -r /tmp/funmusic/third_party /app/third_party \
    && cp /tmp/funmusic/setup.py /app/setup.py \
    # Upstream setup.py reads README.md for its long_description, so the install
    # fails outright without it — the Space's own README is NOT a substitute.
    && cp /tmp/funmusic/README.md /app/README.md \
    && rm -rf /tmp/funmusic

# Upstream hardcodes attn_implementation="flash_attention_2" in qwen_encoder.py,
# which no config edit can reach. flash-attn is an optional build below, so the
# request is rewritten at BUILD time to PyTorch's SDPA kernel (equivalent for
# inference) — baked in rather than patched at runtime, so a render can never
# race the patch.
RUN sed -i 's/flash_attention_2/sdpa/g' /app/inspiremusic/transformer/qwen_encoder.py

RUN pip install --no-cache-dir torch==2.3.1 torchaudio==2.3.1 --index-url https://download.pytorch.org/whl/cu121

# openai-whisper's setup.py imports pkg_resources, which setuptools >=81 no longer
# ships. pip builds it in an ISOLATED env, so pinning setuptools in the image is
# not enough on its own — PIP_CONSTRAINT is also applied to build dependencies,
# which is what actually holds the pin inside that isolated build env.
RUN printf 'setuptools<81\nwheel\n' > /tmp/constraints.txt
ENV PIP_CONSTRAINT=/tmp/constraints.txt
RUN pip install --no-cache-dir "setuptools<81" wheel

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
# Installed on its own with build isolation OFF so it uses the setuptools pinned
# above (its setup.py still imports pkg_resources, dropped in setuptools >=81).
# A PIP_CONSTRAINT pin does NOT reach pip's isolated build env, so bypassing that
# isolation is the only thing that actually holds the pin during the build.
RUN pip install --no-cache-dir --no-build-isolation openai-whisper==20231117
# --no-deps is required, not an optimization: upstream's setup.py pins
# fastapi==0.111.0 AND gradio==5.5.0, which demands fastapi>=0.115 — an
# unsolvable pair. Our requirements.txt is the real dependency set, and the
# gradio demo deps upstream pins are unused here (we serve FastAPI ourselves).
RUN pip install --no-cache-dir --no-deps --no-build-isolation -e /app

# flash-attn is a speed-up, not a requirement — a build failure here must not
# take the whole image down with it.
RUN pip install --no-cache-dir flash-attn==2.6.3 --no-build-isolation || \
    echo "flash-attn unavailable — continuing without it"

COPY app.py /app/app.py

# Checkpoints, jobs and outputs all live on the mounted Storage bucket. Created
# here so the container still starts (degraded) if the mount is missing.
RUN mkdir -p /data/jobs /data/outputs /data/prompts
# Checkpoints live on the container disk — the mounted volume refuses the
# downloaders' temp files (see MODEL_ROOT in app.py).
RUN mkdir -p /models && chmod 777 /models

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860", "--timeout-keep-alive", "600"]