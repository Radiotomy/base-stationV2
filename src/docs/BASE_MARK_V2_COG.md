# BASE Mark V2 — Replicate Model Deployment Kit

One-time procedure to publish the SilentCipher neural watermark engine as a
**private model** on your Replicate account (`speedwolf2000`). After this push,
BASE Station's `embedBaseMarkV2` / `detectBaseMarkV2` functions light up
automatically — no further changes needed.

---

## Prerequisites (on your PC)

1. **Docker Desktop** installed and running (Windows: enable WSL2 integration).
2. **Cog** installed — in a terminal (Windows: inside WSL2/Ubuntu):
   ```bash
   sudo curl -o /usr/local/bin/cog -L https://github.com/replicate/cog/releases/latest/download/cog_$(uname -s)_$(uname -m)
   sudo chmod +x /usr/local/bin/cog
   ```
3. Create the empty model on Replicate: go to **replicate.com/create**, name it
   `base-mark-v2`, set visibility to **Private**, hardware **Nvidia T4** (cheapest GPU).

---

## Step 1 — create a folder with these files

Make a folder (e.g. `base-mark-v2/`) and put these files in it.

### File 1: `cog.yaml`

> Uses the modern Cog schema (`run` + `python_requirements`). The legacy
> `predict` / `python_packages` fields still work but emit deprecation warnings.

```yaml
build:
  gpu: true
  python_version: "3.10"
  python_requirements:
    - "torch==2.1.0"
    - "librosa==0.10.1"
    - "soundfile==0.12.1"
    - "git+https://github.com/sony/silentcipher.git"
run: "predict.py:Predictor"
```

### ⚠️ Bundle the model weights into the image

`silentcipher.get_model()` **downloads** the 44.1 kHz checkpoint from
HuggingFace by default. Replicate runs **each prediction in a throwaway
container** — files downloaded during `setup()` do NOT persist to the next
run, so every cold start re-downloads, and that download routinely hangs (the
deployment sits in `starting` for minutes with no logs). Bake the weights into
the image and load them by local path instead.

```bash
# from inside your base-mark-v2/ folder, before pushing
huggingface-cli download Sony/SilentCipher \
  --repo-type model \
  --local-dir weights \
  --include "Models/44_1_khz/73999_iteration/*"
```

Keep the `weights/` folder in the same directory as `predict.py` and `cog.yaml`
so `cog push` ships it inside the image (the folder layout mirrors the HF repo):
`weights/Models/44_1_khz/73999_iteration/`  contains the checkpoint and
`hparams.yaml`. See <https://huggingface.co/Sony/SilentCipher/tree/main> if the
path has changed.

### File 2: `predict.py`

```python
import json
import os
import torch
import librosa
import soundfile as sf
from cog import BasePredictor, Input, Path


class Predictor(BasePredictor):
    def setup(self):
        import silentcipher
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        # Load the bundled checkpoint instead of re-downloading on every boot.
        ckpt_dir = os.path.join(os.path.dirname(__file__), "weights", "Models", "44_1_khz", "73999_iteration")
        self.model = silentcipher.get_model(
            model_type="44.1k",
            device=self.device,
            ckpt_path=ckpt_dir,
            config_path=os.path.join(ckpt_dir, "hparams.yaml"),
        )
        print("[base-mark-v2] model loaded from bundled weights")

    def run(
        self,
        action: str = Input(choices=["encode", "decode"], description="encode = embed watermark, decode = detect"),
        audio: Path = Input(description="Input audio file (WAV, 44.1kHz preferred)"),
        message: str = Input(default="[181,0,0,0,0]", description="JSON array of five integers 0-255 (encode only)"),
        message_sdr: float = Input(default=47.0, description="Embed strength in dB SDR — higher = more inaudible, lower = more robust"),
    ) -> Path:
        y, sr = librosa.load(str(audio), sr=44100, mono=True)

        if action == "encode":
            msg = json.loads(message)
            encoded, _ = self.model.encode_wav(y, sr, msg, message_sdr=message_sdr)
            out = "/tmp/watermarked.wav"
            sf.write(out, encoded, sr)
            return Path(out)

        result = self.model.decode_wav(y, sr, phase_shift_decoding=True)
        out = "/tmp/result.json"
        with open(out, "w") as f:
            json.dump({
                "detected": bool(result.get("status")),
                "messages": result.get("messages", []),
                "confidences": result.get("confidences", []),
            }, f)
        return Path(out)
```

---

## Step 2 — test locally (recommended)

From inside the folder (this downloads the SilentCipher checkpoints on first run):

```bash
cog predict -i action=encode -i audio=@some_test_song.wav -i message="[181,1,2,3,4]"
cog predict -i action=decode -i audio=@output.wav
```

The decode should report `"detected": true` with message `[181, 1, 2, 3, 4]`.
If `silentcipher.get_model` errors about checkpoints, check the
[sony/silentcipher README](https://github.com/sony/silentcipher) for the current
`get_model` signature — the API occasionally changes — and adjust `setup()` to match.

---

## Step 3 — push to your Replicate account

```bash
cog login
cog push r8.im/speedwolf2000/base-mark-v2
```

The first push uploads a few GB (one time only).

---

## Step 4 — tell the Base44 chat "the model is pushed"

We'll run a live end-to-end test (embed → detect → registry match) and flip the
V2 roadmap status to **live**.

---

## How V2 integrates (already built, waiting on the model)

| Piece | Status |
|---|---|
| `shared/baseMarkV2` — 40-bit message packing (magic byte + V1 payload) | ✅ built |
| `embedBaseMarkV2` — neural embed via Replicate, persists master + registry | ✅ built |
| `detectBaseMarkV2` — neural detect, resolves V1 **and** V2 registry records | ✅ built |
| Private model on Replicate | ⬜ your push |

The 40-bit neural message carries the same 32-bit payload as BASE Mark V1, so a
track marked with both layers resolves to a single registry record. Model name
is configurable via the `BASE_MARK_V2_MODEL` secret (defaults to
`speedwolf2000/base-mark-v2`).