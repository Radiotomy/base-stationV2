FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Only /tmp and /data are writable on a Space. /data is the PERSISTENT mount, so
# voicebanks live there — a bank under /tmp would have to be re-uploaded every
# time the Space restarts.
ENV VOICEBANK_DIR=/data/voicebanks \
    XDG_CACHE_HOME=/tmp/cache \
    HF_HOME=/tmp/hf

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]