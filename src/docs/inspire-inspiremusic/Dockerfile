# Inspire (InspireMusic) engine Space — CUDA + conda base, because pynini (a
# WeTextProcessing dependency) cannot be built reliably by pip and has to come
# from conda-forge.
FROM nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04

# The Space environment arrives with CUDA_VISIBLE_DEVICES=1, which on a
# single-GPU box names a device that does not exist — torch then reports
# device_count 0 and the render falls back to CPU (measured: the render
# thread saw cuda_available False while the web thread saw True). Pinned to
# the first visible device so every thread in the process agrees. The comment
# sits ABOVE the instruction on purpose: a comment line inside a backslash
# continuation terminates the ENV early and breaks the whole build.
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/third_party/Matcha-TTS \
    INSPIRE_DATA_DIR=/data \
    CUDA_VISIBLE_DEVICES=0

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

# Weights are baked into the IMAGE, not downloaded at first render. The
# container disk is ephemeral, so a runtime download repeated itself on every
# cold start and put a multi-GB fetch in front of the creator's first render.
# An image layer is cached by the Space builder, so a restart is instant.
# The sed also flattens upstream's relative yaml paths (they only resolve from
# its own examples/ dir) and rewrites the flash_attention_2 request to sdpa.
# Downloaded into the ModelScope CACHE and then COPIED, never via local_dir: with
# local_dir the client resolves the snapshot through a dot-mangled symlink
# ('InspireMusic-1___5B-Long') whose creation fails on this filesystem, so the
# target folder was left without inspiremusic.yaml, the image shipped no usable
# checkpoint, and the engine re-downloaded multiple GB on every cold start —
# which is exactly the "loading model" wait in front of the first render.
# Downloaded and MOVED, never copied: a copytree holds the whole multi-GB tree in
# flight alongside the original and the Space builder is OOM-killed (exit 137)
# partway through. A move is a rename on the same filesystem — no second copy, no
# memory spike. The fetch is also pinned to one worker: modelscope's parallel
# downloader buffers each shard in memory, and several multi-GB shards at once is
# the other half of the same OOM.
ENV MODELSCOPE_DOWNLOAD_PARALLELS=1
RUN python -c "from modelscope import snapshot_download; p = snapshot_download('iic/InspireMusic-1.5B-Long', cache_dir='/models/.modelscope'); print(p)" > /tmp/ckpt_path \
    && mv "$(cat /tmp/ckpt_path | tail -n1)" /models/InspireMusic-1.5B-Long \
    && rm -rf /models/.modelscope /tmp/ckpt_path \
    && test -f /models/InspireMusic-1.5B-Long/inspiremusic.yaml \
    && sed -i -e "s|\.\./\.\./||g" -e "s/flash_attention_2/sdpa/g" /models/InspireMusic-1.5B-Long/inspiremusic.yaml \
    && chmod -R 777 /models

# Upstream calls torch.load() with NO map_location (vqvae.py is the first one a
# render hits) and the published checkpoints were saved from a CUDA device, so
# torch tries to restore each storage onto that exact device and dies with
# "Attempting to deserialize object on a CUDA device but torch.cuda.is_available()
# is False". app.py patches torch.load, but the checkpoint is loaded from a WORKER
# THREAD via hyperpyyaml, and a stale app.py on the Space leaves that patch out
# entirely. sitecustomize is imported by the interpreter itself before ANY app or
# library code, so the mapping cannot be raced or skipped. Loading to CPU first
# and moving the model to its device afterwards is the standard contract and is
# correct on GPU too.
RUN printf '%s\n' \
  "try:" \
  "    import torch" \
  "    _orig_load = torch.load" \
  "    def _cpu_first_load(*a, **kw):" \
  "        kw.setdefault('map_location', 'cpu')" \
  "        return _orig_load(*a, **kw)" \
  "    torch.load = _cpu_first_load" \
  "except Exception:" \
  "    pass" \
  > /opt/conda/lib/python3.10/site-packages/sitecustomize.py

COPY app.py /app/app.py

# Checkpoints, jobs and outputs all live on the mounted Storage bucket. Created
# here so the container still starts (degraded) if the mount is missing.
RUN mkdir -p /data/jobs /data/outputs /data/prompts
# Checkpoints live on the container disk — the mounted volume refuses the
# downloaders' temp files (see MODEL_ROOT in app.py).
RUN mkdir -p /models && chmod 777 /models

EXPOSE 7860

# Started through an explicit shell that reports what it found BEFORE handing off
# to uvicorn. The Space exited 0 with nothing but the CUDA banner in the log —
# no traceback and no uvicorn line — which says the handoff itself failed rather
# than the app crashing. These three lines separate the possible causes (missing
# interpreter, unimportable app module, uvicorn returning immediately) instead of
# leaving them indistinguishable. `exec` keeps uvicorn as PID 1 so signals and
# exit codes still reach it.
CMD ["bash", "-lc", "\
echo \"[boot] python=$(which python) $(python -V 2>&1)\"; \
echo \"[boot] uvicorn=$(which uvicorn)\"; \
python -c 'import app; print(\"[boot] app module imported OK\")' || echo '[boot] APP IMPORT FAILED'; \
exec uvicorn app:app --host 0.0.0.0 --port 7860 --timeout-keep-alive 600 --log-level info"]