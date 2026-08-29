# Siren Song HF Space — required fixes (2026-08-29)

## What actually happened to job `ca62e4d4-8681-4d75-b8b5-10ad385d366e`

The status registry on the Space itself reports, right now:

```json
{ "status": "failed",
  "error": "Could not load this library: /home/user/.local/lib/python3.10/site-packages/torchcodec/libtorchcodec_image.so" }
```

The generation loop DID succeed (both lazy_load unloads, 10/10 progress) — but the
job died at the very last step, **writing the WAV**. Recent `torchaudio.save()`
routes through the new `torchcodec` backend, whose native library fails to load
in the Space image. Because the crash is in the save call, **no WAV was ever
written to /tmp/outputs — there is no file to recover.** BASE Station's poller
reported exactly what the engine said; it was not a stale popup.

## Fix 1 — save with soundfile, never torchaudio.save

In `app.py`, replace the save step at the end of the generation worker:

```python
# OLD (crashes: torchcodec backend)
# torchaudio.save(out_path, audio, 48000)

# NEW — direct libsndfile write, no torchcodec involved
import soundfile as sf
sf.write(out_path, audio.detach().cpu().numpy().T, 48000, subtype="FLOAT")
```

(`audio` is [channels, samples]; soundfile wants [samples, channels], hence `.T`.
If your tensor is already 1-D mono, drop the `.T`.)

Add to `requirements.txt`:

```
soundfile
```

## Fix 2 — the API has no /outputs route at all

The live Space exposes only `/`, `/generate/audio`, `/status/{job_id}`
(confirmed via `openapi.json`). The `download_url: /outputs/<file>.wav` the
status response promises would 404 even for a successful render — BASE Station
could never fetch the finished track. Mount the directory in `app.py`:

```python
from fastapi.staticfiles import StaticFiles
import os

os.makedirs("/tmp/outputs", exist_ok=True)
app.mount("/outputs", StaticFiles(directory="/tmp/outputs"), name="outputs")
```

(Same pattern the private LTX video Space uses.)

## After restarting the Space

No BASE Station changes are needed — `pollSirenSongJob` already downloads
`download_url`, persists the WAV to storage, saves it to the library and
deducts credits on completion. Run one fresh generation from the Siren Song
tab to confirm the full loop.