# Skye Space — the real DiffRhythm 2 handler

**This is the fix for the silent-stub problem.** The Space currently answers
`/generate/audio` and `/status/{id}` correctly but writes a 1.0 s silent
placeholder WAV, so every render "succeeds" while producing nothing. BASE Station
now rejects that output (peak-amplitude + duration guard in `persistSkyeWav`), so
no creator is billed for it — but the Space must be replaced with the handler
below to actually generate music.

Verified against upstream `ASLP-lab/DiffRhythm2/inference.py`. Three facts drove
the BASE Station contract and must not be "improved" here:

1. **There is no negative prompt.** Style is a single MuLan embedding. The model
   signature has `style_prompt` and nothing else — a negative field would be a
   control that does nothing.
2. **Text and reference audio are mutually exclusive.** `mulan(texts=[...])` or
   `mulan(wavs=...)`, never both. BASE Station rejects a request carrying both.
3. **Real ceiling is 210 s** (upstream `--max-secs` default), not the 285 s
   inherited from DiffRhythm 1.

Upstream writes `.mp3`. We write `.wav`: BASE Mark's forensic layer needs PCM, and
marking a lossy file first then transcoding destroys the watermark.

## `app.py`

```python
import os, io, re, json, uuid, random, threading, tempfile, datetime
import torch, torchaudio, numpy as np, pedalboard, requests
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from muq import MuQMuLan
from diffrhythm2.cfm import CFM
from diffrhythm2.backbones.dit import DiT
from bigvgan.model import Generator
from huggingface_hub import hf_hub_download
from inference import parse_lyrics, make_fake_stereo, CNENTokenizer
import inference as inf_mod

REPO_ID = os.environ.get("SKYE_REPO_ID", "ASLP-lab/DiffRhythm2")
OUTPUT_DIR = "/tmp/outputs"
MIN_SECS, MAX_SECS = 95.0, 210.0

os.makedirs(OUTPUT_DIR, exist_ok=True)      # BEFORE the mount, or startup raises
app = FastAPI()
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
JOBS = {}                                   # job_id -> status dict
_LOCK = threading.Lock()                    # one GPU, one render at a time
MODEL = None

def load_models():
    """Loaded once at import. A per-request load would re-download 3B weights."""
    global MODEL
    if MODEL is not None:
        return MODEL
    cfg_path = hf_hub_download(REPO_ID, "config.json", local_dir="./ckpt")
    ckpt_path = hf_hub_download(REPO_ID, "model.safetensors", local_dir="./ckpt")
    with open(cfg_path) as f:
        model_config = json.load(f)
    model_config["use_flex_attn"] = False

    from safetensors.torch import load_file
    cfm = CFM(
        transformer=DiT(**model_config),
        num_channels=model_config["mel_dim"],
        block_size=model_config["block_size"],
    ).to(DEVICE)
    cfm.load_state_dict(load_file(ckpt_path))

    mulan = MuQMuLan.from_pretrained("OpenMuQ/MuQ-MuLan-large", cache_dir="./ckpt").to(DEVICE)
    decoder = Generator(
        hf_hub_download(REPO_ID, "decoder.json", local_dir="./ckpt"),
        hf_hub_download(REPO_ID, "decoder.bin", local_dir="./ckpt"),
    ).to(DEVICE)

    # inference.parse_lyrics reads the module-level tokenizer — set it, or every
    # lyric line raises AttributeError on a None tokenizer.
    inf_mod.lrc_tokenizer = CNENTokenizer()

    if DEVICE.type != "cpu":
        cfm, decoder = cfm.half(), decoder.half()
    cfm.eval(); decoder.eval()
    MODEL = (cfm, mulan, decoder)
    return MODEL

load_models()


class GenReq(BaseModel):
    lyrics: str = "[instrumental]"
    style_prompt: str = ""
    reference_audio_url: str | None = None
    duration: float = 95.0
    seed: int | None = None
    cfg_strength: float = 2.0
    sample_steps: int = 16


def style_embed(mulan, req):
    """Text OR reference audio — never both, matching upstream MuLan usage."""
    if req.reference_audio_url:
        r = requests.get(req.reference_audio_url, timeout=120)
        r.raise_for_status()
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
            tf.write(r.content)
            path = tf.name
        wav, sr = torchaudio.load(path)
        os.unlink(path)
        wav = torchaudio.functional.resample(wav.to(DEVICE), sr, 24000)
        if wav.shape[1] > 24000 * 10:                 # upstream samples a 10s window
            start = random.randint(0, wav.shape[1] - 24000 * 10)
            wav = wav[:, start:start + 24000 * 10]
        wav = wav.mean(dim=0, keepdim=True)
        with torch.no_grad():
            emb = mulan(wavs=wav)
    else:
        if not req.style_prompt.strip():
            raise ValueError("style_prompt or reference_audio_url is required")
        with torch.no_grad():
            emb = mulan(texts=[req.style_prompt])
    emb = emb.to(DEVICE).squeeze(0)
    return emb.half() if DEVICE.type != "cpu" else emb


def render(job_id, req):
    cfm, mulan, decoder = MODEL
    try:
        JOBS[job_id].update(status="processing", progress="Encoding style…")
        if req.seed is not None:
            torch.manual_seed(req.seed); random.seed(req.seed); np.random.seed(req.seed)

        prompt = style_embed(mulan, req)

        JOBS[job_id]["progress"] = "Tokenizing lyrics…"
        tokens = parse_lyrics(req.lyrics or "[instrumental]")
        text = torch.tensor(sum(tokens, []), dtype=torch.long, device=DEVICE)

        JOBS[job_id]["progress"] = "Running block flow matching…"
        duration = max(MIN_SECS, min(float(req.duration), MAX_SECS))
        with _LOCK, torch.inference_mode():
            latent = cfm.sample_block_cache(
                text=text.unsqueeze(0),
                duration=int(duration * 5),
                style_prompt=prompt.unsqueeze(0),
                steps=req.sample_steps,
                cfg_strength=req.cfg_strength,
                process_bar=False,
            ).transpose(1, 2)
            audio = decoder.decode_audio(latent, overlap=5, chunk_size=20)

        JOBS[job_id]["progress"] = "Writing WAV…"
        sr = decoder.h.sampling_rate
        audio = audio.float().cpu().numpy().squeeze()[None, :]
        audio = make_fake_stereo(audio, sr)          # 2ch, as upstream default
        stamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"skye_v2_{stamp}_{job_id[:8]}.wav"
        path = os.path.join(OUTPUT_DIR, filename)
        # PCM WAV, not MP3 — BASE Mark needs lossless PCM to embed into.
        with pedalboard.io.AudioFile(path, "w", sr, 2) as f:
            f.write(audio)

        JOBS[job_id].update(
            status="completed", progress="Generation complete",
            file_path=path, filename=filename,
            download_url=f"/outputs/{filename}",
            sample_rate=sr, duration=duration,
        )
    except Exception as e:
        JOBS[job_id].update(status="failed", error=str(e), progress="Failed")


@app.post("/generate/audio")
def generate(req: GenReq):
    if not req.style_prompt.strip() and not req.reference_audio_url:
        raise HTTPException(400, "style_prompt or reference_audio_url is required")
    job_id = uuid.uuid4().hex
    JOBS[job_id] = {"status": "queued", "progress": "Queued"}
    # Returns immediately: a 200s render would blow any HTTP timeout.
    threading.Thread(target=render, args=(job_id, req), daemon=True).start()
    return {"job_id": job_id, "status": "queued"}


@app.get("/status/{job_id}")
def status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "unknown job")
    return {"job_id": job_id, **job}


@app.get("/health")
def health():
    return {"ok": True, "device": str(DEVICE), "model_loaded": MODEL is not None}
```

## `requirements.txt` additions

```
fastapi
uvicorn
pedalboard
requests
muq
```

Plus the upstream repo's own `requirements.txt`, and `espeak-ng` via
`packages.txt` (the g2p frontend shells out to it — without it every lyric line
fails while instrumentals still work, which reads as "lyrics are ignored").

## Verify after restart

1. `GET /health` → `model_loaded: true`, `device: cuda`.
2. Submit a 95 s instrumental. `GET /status/{id}` should end `completed`.
3. Fetch `download_url` — expect **200**, `audio/x-wav`, body well over 10 KB.
4. Generate from Music Studio → Skye. It must land in the library with real
   audio; BASE Station's silence guard rejects a flat or sub-second file, so a
   track appearing at all now means the render is genuine.