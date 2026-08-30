# Skye Space — required fix: mount `/outputs`

**Status:** BASE Station side is complete and wired. Skye renders audio successfully.
The ONLY thing blocking end-to-end generation is that the Space does not serve the
file it just wrote.

## Symptom

`GET /status/{job_id}` reports success and names a real file:

```json
{
  "status": "completed",
  "progress": "Generation complete",
  "file_path": "/tmp/outputs/skye_v2_20260830_213532.wav",
  "filename": "skye_v2_20260830_213532.wav",
  "download_url": "/outputs/skye_v2_20260830_213532.wav"
}
```

…but fetching that `download_url` returns **HTTP 404**:

| Probe | Result |
|---|---|
| `GET /outputs/skye_v2_20260830_213532.wav` | 404 |
| `GET /outputs` | 404 |
| `GET /file=/tmp/outputs/…` | 404 |

`download_url` is advertised as an HTTP path, but no route or static mount exists
at `/outputs`, so the rendered WAV is unreachable. `file_path` is a path *inside*
the container and is never fetchable from outside — BASE Station deliberately
ignores it rather than guessing a URL from it.

This is the same defect Siren Song had (see
`src/docs/siren-song-heartmula/SPACE_FIXES_2026-08-29.md`) — the fix is identical.

## Fix (one mount, in the Space's FastAPI app)

Add this once, after the app is created:

```python
import os
from fastapi.staticfiles import StaticFiles

OUTPUT_DIR = "/tmp/outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)          # must exist BEFORE mounting
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")
```

Notes:

- `os.makedirs(..., exist_ok=True)` must run before `app.mount(...)`. Mounting a
  missing directory raises at startup, which would take the whole Space down
  instead of just failing downloads.
- Mount at import time, not inside the generate handler — a mount added per
  request is not registered on the running router.
- Keep the response contract exactly as it is. `download_url` already matches the
  mount path, so no field renaming is needed and no BASE Station change is
  required once this is in.

## Verify

After the Space restarts, run one generation and fetch the returned
`download_url`. It must return **200** with `content-type: audio/x-wav` (or
`audio/wav`) and a body of more than 10 KB — BASE Station rejects anything smaller
as "output too small to be audio", since a tiny body means an HTML error page
rather than a render.

## BASE Station side — no changes needed

Already implemented and verified:

- `base44/shared/skyeEngine.ts` — submit / status / persist, with the ceiling at
  285 s and the default negative prompt.
- `base44/functions/generateMusicSkye` — validated submit; returned a `job_id` in
  1.3 s on the live Space.
- `base44/functions/pollSkyeJob` — persists the WAV into Base44 storage, generates
  cover art, saves the library asset, then deducts credits.
- `src/components/music/SkyeGenerateTab.jsx` + `SkyeStyleControls.jsx` — the
  Music Studio tab.

Credit handling is already safe against this failure: credits are deducted **only**
after the WAV is fetched and persisted, so the failed smoke-test render cost the
creator nothing.