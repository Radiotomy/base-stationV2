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

> Uses the modern Cog schema (`run` + `python_requirements` as a **path to a
> requirements file**). The legacy `predict` / `python_packages` fields and the
> inline-list form of `python_requirements` still build, but **do not use the
> inline-list form** — it installs silentcipher as a separate pip transaction
> with no scipy/numpy pin, so pip pulls scipy 1.13+ (built against the NumPy 2.x
> C-API) on top of the 1.x numpy torch requires, reproducing
> `RuntimeError: Numpy is not available` at `import silentcipher` time. Always
> point `python_requirements` at the pinned `requirements.txt` in this folder.

```yaml
build:
  gpu: true
  python_version: "3.10"
  python_requirements: requirements.txt
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
# from inside your base-mark-v2/ folder, before pushing.
# NOTE: the HF repo layout is Sony/SilentCipher/44_1_khz/73999_iteration/
# (at the ROOT — there is NO Models/ directory on HF; Models/ only exists in
# the GitHub repo as an empty placeholder). An earlier version of this doc
# used --include "Models/44_1_khz/...", which matches nothing on HF, silently
# downloads ZERO bytes, forces silentcipher back to a per-cold-start HF
# download inside the throwaway container, and hangs the deployment in
# "starting" for minutes. Use the ROOT path below.

# Pin an explicit HF revision so the bundle is reproducible + tamper-evident.
# This is the same revision audited by the Irodori-TTS team (a third-party
# integrator who published a SHA-256 manifest of every blob — see
# ⚠️ License note below).
huggingface-cli download Sony/SilentCipher \
  --repo-type model \
  --revision a1c4d021905e0dc5b24be5f68db5fc4dba410ee1 \
  --local-dir weights \
  --include "44_1_khz/73999_iteration/*"

# opt.ckpt is optimizer STATE — silentcipher never loads it at inference
# (only enc_c / dec_c / dec_m_0 + hparams.yaml). Drop it to shrink the image.
rm -f weights/44_1_khz/73999_iteration/opt.ckpt

# Verify the four blobs we ship against the audited SHA-256 manifest BEFORE
# `cog push`, so a silently-tampered or partially-downloaded weight is caught
# at build time instead of producing wrong watermarks in production.
sha256sum -c <<'EOF'
ff64f80d2391fdfc888e4103c499be4a2c958e59626587a1eab6db93204814c7  weights/44_1_khz/73999_iteration/enc_c.ckpt
c23b57635172b2fbd3a8531d15ba76b5885a10d0fe902ccb823c521c56041b33  weights/44_1_khz/73999_iteration/dec_c.ckpt
829540c058270d29788f05294894d45bf436e44add0e1099422242ebb94b7088  weights/44_1_khz/73999_iteration/dec_m_0.ckpt
27735fd4db0c00c29fef7af872ad1e5efe854e48d530a86c75beac2b87f09ce3  weights/44_1_khz/73999_iteration/hparams.yaml
EOF
```

Keep the `weights/` folder in the same directory as `predict.py` and `cog.yaml`
so `cog push` ships it inside the image. After the steps above the local layout
is `weights/44_1_khz/73999_iteration/` containing `enc_c.ckpt`, `dec_c.ckpt`,
`dec_m_0.ckpt`, and `hparams.yaml` (~30 MB). See
<https://huggingface.co/Sony/SilentCipher/tree/main/44_1_khz/73999_iteration>
if the path or revision has changed.

### ⚠️ License note — model weights

The silentcipher **source code** on GitHub is MIT-licensed. Sony has NOT
published an explicit license for the **model-weight blobs** on Hugging Face,
nor terms governing audio watermarked with those weights. A third-party
integrator (the Irodori-TTS team) filed a formal clarification request with
Sony in 2024 asking exactly this; until Sony replies, commercial use of the
weights sits in an **unconfirmed** (not blocked, not cleared) legal gap.

Practical posture for BASE Mark V2:

- Internal / forensic provenance use (marking your own assets, registry
  match, embed→detect QA) is low-risk and is what we ship by default.
- Do NOT assert "MIT-licensed, commercially cleared" for the weights in any
  seller-facing docs or partner terms until Sony confirms.
- We mirror the Irodori-TTS provenance practice (pinned revision + SHA-256
  manifest) so our build is reproducible and auditable regardless of the
  eventual license outcome. Track Sony's reply and update this note when it
  lands.

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
        # NOTE: no "Models" segment — the HF repo layout is
        # `Sony/SilentCipher/44_1_khz/73999_iteration/` at the root, and the
        # `huggingface-cli download --local-dir weights` step mirrors that
        # exactly. An extra "Models" here would point at a non-existent path,
        # force silentcipher back to a per-cold-start HF download, and hang.
        ckpt_dir = os.path.join(os.path.dirname(__file__), "weights", "44_1_khz", "73999_iteration")
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

> If you have pushed this model before, **bust the Docker layer cache** so the
> pip-install layer is actually rebuilt with the pinned `requirements.txt`
> below. A cached layer from a previously-broken build will silently re-ship the
> old scipy 1.13+ and reproduce `RuntimeError: Numpy is not available` even
> though the file on disk says `scipy==1.12.0`:

```bash
cog login
cog push --no-cache r8.im/speedwolf2000/base-mark-v2
```

The first push uploads a few GB (one time only). After it lands, run on Replicate:
**create a new deployment release pinned to the new image digest** (or update the
existing `base-mark-v2` deployment's release to the new digest). The deployment
endpoint **ignores** a `version` field on individual predictions — only the
deployment's current release controls which image runs. Confirm the new digest is
active in the Replicate UI before testing.

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