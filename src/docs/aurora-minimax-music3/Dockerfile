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

# Weights live on the container disk, NOT /data: ~22GB of bf16 weights would force
# a much larger (and pricier) storage tier, while the restart problem that
# actually needed solving is losing job records and finished renders.
ENV HF_XET_HIGH_PERFORMANCE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]