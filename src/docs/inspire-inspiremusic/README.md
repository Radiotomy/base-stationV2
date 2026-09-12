# Inspire — BASE Station's InspireMusic engine

In-house engine built on the open-source **InspireMusic** toolkit
(<https://github.com/QwenAudio/FunMusic>, FunAudioLLM, **Apache-2.0**), self-hosted
on our own Hugging Face Space. Referred to in all creator-facing copy as
**BASE Inspire** — never by its host.

## What the model actually is

Audio tokenizer → **Qwen2.5-backbone autoregressive transformer** (next-token
prediction over interleaved text and audio tokens) → **flow-matching
super-resolution** stage that lifts the 24kHz token stream into high-resolution
latents → vocoder. Paper: <http://arxiv.org/abs/2503.00084>.

Two released tasks:

| Task | Input | Notes |
|---|---|---|
| `text-to-music` | English prose description | Reads a *description of the production*, not comma tags |
| `continuation` | Audio prompt (+ optional text) | Keeps composing from the first ~5s of the prompt |

**It is instrumental.** `InspireSong-1.5B` (vocals) and `InspireAudio-1.5B` were
announced but never released, so there is no lyric or vocal channel — the studio
tab deliberately has no lyrics field.

## Checkpoints exposed

| Checkpoint | Rate | Ceiling | Why it's offered |
|---|---|---|---|
| `InspireMusic-1.5B-Long` | 48kHz | 300s | Only one trained for multi-minute coherence — the default |
| `InspireMusic-1.5B` | 48kHz | 90s | Sharper on short pieces |
| `InspireMusic-Base` | 48kHz | 90s | Lighter, quicker |
| `InspireMusic-1.5B-24kHz` | 24kHz | 90s | Skips flow matching entirely — draft speed |

Minimum render is **10s** (upstream refuses below it).

## Why Inspire is its own provider, not a variant of another

1. **48kHz native stereo** — the highest source rate on the platform (Aurora
   32kHz, Siren Song / Skye 44.1kHz). An Inspire render is therefore the best
   available master for mastering, stem separation and BASE Mark. The delivered
   rate is **measured from the WAV header** in `persistInspireWav`, never assumed
   from the requested checkpoint.
2. **Continuation** — the only engine that composes *from* a creator's own
   recording. Those renders are `ai_assisted`, not `ai_generated`, and the saved
   asset carries `parent_asset_id` back to its source. The source is resolved
   server-side from the caller's own library; a client-supplied URL is rejected,
   so nobody can seed a render with audio they don't own.
3. **Section conditioning** — `intro | verse | chorus | outro` is a real
   conditioning token, which makes Inspire usable as a section factory for
   SUB-Station rather than only a one-shot song generator.

## Platform wiring

| Piece | Path |
|---|---|
| Engine client | `base44/shared/inspireEngine.ts` |
| Submit | `base44/functions/generateMusicInspire/entry.ts` |
| Finalize (persist + cover + library + credits) | `base44/functions/pollInspireJob/entry.ts` |
| Studio UI | `src/components/music/InspireGenerateTab.jsx` (BASE Engines tab) |
| Space handler | `src/docs/inspire-inspiremusic/app.py` |

Cost: **13 credits**, deducted on completion only. Finished renders are rescued by
both the notification watchdog and `autoPollStuckJobs`, so a creator who navigates
away still gets the track.

## Space deployment

1. Space → Docker, GPU (L4 or better; the 1.5B checkpoints need ~16GB for a
   comfortable 48kHz pass).
2. Attach **persistent Storage mounted at `/data`** — non-negotiable. Without it
   the job table and every render vanish on restart.
3. Secrets on the Space: `HF_TOKEN` (checkpoint download).
4. If the Space is not at `https://radiotomy-inspire.hf.space`, set the app secret
   `INSPIRE_ENGINE_URL` to its real base URL.
5. Sanity check: `GET /health` → `{"ok": true, ...}`.

Weights download into `/data/pretrained_models` on first use of each checkpoint,
so the first render after a fresh mount is slow and later ones are not.