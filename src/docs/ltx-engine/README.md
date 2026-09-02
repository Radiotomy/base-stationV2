# BASE Station LTX Engine — self-hosted text-to-video

Our own LTX video engine, hosted on a Hugging Face Space. It is the **primary**
path for Text-to-Video in Video Studio; the public LTX API is the fallback and
the only path for Image-to-Video and Audio-to-Video.

- **Space:** `radiotomy/basestation-ltx-engine` → `https://radiotomy-basestation-ltx-engine.hf.space`
- **Client:** `base44/shared/privateLtx.ts` (`tryPrivateLtxVideo`)
- **Caller:** `base44/functions/generateVideoLTX/entry.ts`
- **Secret:** none — the Space is public-read. `LTX_API_KEY` is still required
  because the function refuses to run without a working fallback.
- **History:** first hosted on RunPod; moved to a Space because RunPod's proxy
  killed every HTTP request at ~100 s with a 524, which no client timeout could
  survive.

---

## Contract

Async submit-and-poll, same shape as Coda / Siren Song / Skye:

```
POST /generate/video   { prompt, negative_prompt, num_inference_steps,
                         width, height, num_frames, fps, seed }
                       → { job_id }
GET  /status/{job_id}  → { status: pending|processing|completed|failed,
                           download_url?, error? }
GET  {BASE}{download_url} → the rendered MP4
```

### Fixed render format

The engine renders ONE format. Nothing the creator picks in the studio changes it.

| Parameter | Value |
|---|---|
| Resolution | 768 × 512 (landscape) |
| Frames / fps | 97 @ 24 fps → **≈ 4.0 s** |
| Inference steps | 40 |
| Negative prompt | `worst quality, inconsistent motion, blurry, jittery` (constant) |
| Audio | **none** — silent MP4 |
| Seed | request `seed`, default 42 (reproducible) |

Timing: well under a minute on a warm GPU; a cold Space adds model-load time.
Client budget is 30 s to submit, 5 s poll cadence, 300 s overall deadline, 60 s
to download. Past the deadline the engine is treated as unavailable.

---

## Routing inside `generateVideoLTX`

```
mode === 'text'
   ├─ tryPrivateLtxVideo()  → MP4 already persisted in our storage
   │      success → completed GenerationJob + UserAsset written inline,
   │                credits deducted inline, IPFS pin attempted, 200 { video_url }
   │      null    → fall through
   └─ public LTX API (/v2/text-to-video) → 202 job, finalized by pollGenerationJob
mode === 'image' | 'audio'
   └─ public LTX API only
```

`tryPrivateLtxVideo` **never throws**. Every failure — Space asleep, HTTP error,
no `job_id`, engine `failed`, deadline, unfetchable or <10 KB output, upload
failure — returns `null` and the public path takes over. The creator never sees
which engine rendered; the studio already handles both a synchronous
`video_url` and an async `job_id`.

Output bytes are copied into Base44 storage **before** anything is written to an
entity. Space storage is ephemeral; an `hf.space` URL must never reach a player.

---

## What gets recorded

| Record | Values |
|---|---|
| `GenerationJob` | `provider: 'ltx'`, `input_data.engine: 'hf_private'`, `model: 'ltx-2-5-private-hf'`, `resolution: '768x512'`, `fps: 24`, seed, `credit_cost`; `output_metadata.duration: 4` |
| `UserAsset` | `asset_type: 'video'`, `metadata.engine: 'hf_private'`, `model_version`, seed, `generation_job_id`, optional `ipfs_cid` / `ipfs_uri` / `ipfs_gateway_url` |
| `CreditLog` | `provider: 'ltx'`, description "Private LTX engine video generation" |
| `APIUsageLog` | `provider: 'ltx'`, `task: 'generate_video'`, `metadata.engine: 'hf_private'` |

The `engine` stamp is how a private render is told apart from a public one in
analytics and in the asset library — `provider` stays `ltx` for both because
they are the same model family.

BASE Mark and ID3 are audio-only and are deliberately NOT applied to an MP4.
On-chain anchoring covers whole audio works only, so it is not triggered either.
IPFS pinning is best-effort and non-fatal.

---

## Known gaps (open — decide before promoting out of beta)

1. **Controls vs. output mismatch.** The studio shows model / resolution /
   duration / fps / camera motion / soundtrack controls, and the cost badge is
   computed from them (`ltxCreditCost` on the *selected* model, tier and
   seconds). A text render that lands on the private engine ignores all of those
   and returns a 4 s, 768×512, silent clip — but is billed at the public price
   for what was selected. Options: (a) bill private renders at a flat private
   rate, (b) show a "renders on BASE Station engine: 4 s · 768×512 · silent"
   notice whenever the mode is Text, or (c) honour the selection by sending it
   to the Space once the engine accepts variable formats.
2. **Text-to-video only.** Image and audio conditioning are not exposed by the
   Space yet.
3. **No queue on the Space.** Same single-CUDA-model risk as Coda / Siren Song;
   concurrent submits should be serialised Space-side.
4. **Result badges** in Video Studio still show the *selected* aspect ratio and
   duration, not the rendered ones, after a private render.

Nothing here changes the fallback contract: the public LTX API remains the
correctness floor for every mode.