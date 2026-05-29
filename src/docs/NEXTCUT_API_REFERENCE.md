# NextCut API — Complete Reference

> Captured 2026-05-29 from https://nextcut.io/docs/api-reference and https://nextcut.io
> Primary engine for Base Station's music-video composition pipeline.

---

## 🔑 Auth & Base URL

- **Base URL:** `https://api.nextcut.io`
- **Auth header:** `x-api-key: YOUR_API_KEY` (managed in NextCut admin panel)
- **Stack:** Remotion (engine) + AWS Lambda (render) + Pexels (b-roll) + JSON (scenes)

## 📋 Plan Limits (Base Station is on Starter)

| Plan | Renders/mo | Max Res | Max Duration | Storage | Retention |
|---|---|---|---|---|---|
| Free | 25 | 720p · 30fps | 30s | 500 MB | 3 days |
| **Starter ($39)** | **150** | **1080p · 30fps** | **2 min** | **5 GB** | **14 days** |
| Pro ($149) | 400 | 1080p · 60fps | 5 min | 20 GB | 60 days |
| Scale ($399) | 400 | 4K · 60fps | 10 min | 100 GB | dedicated |

- **Soft overages** — API never hard-stops. Starter overage = **$0.35/render**.
- **Rate limit:** 10 req/min per API key.
- **⚠️ Important:** "Max 1080p" on Starter means **longest dimension ≤ 1080px**. So `1920×1080` is rejected; use `1080×1080`, `1080×720`, or `720×1080`.

---

## 🎬 The Single Endpoint — `POST /api-render`

ONE endpoint handles all three modes via different body shapes:

### Mode 1 — Scenes (raw JSON composition)
```json
{
  "scenes": [{ "startFrame": 0, "endFrame": 90, "layers": [...] }],
  "width": 1080,
  "height": 1080,
  "fps": 30,
  "codec": "h264"
}
```

### Mode 2 — Template
```json
{
  "template": "tmpl_social_reel_v3",
  "fields": { "headline": "...", "background_video": "https://..." }
}
```

### Mode 3 — Stitch (our main use case for music videos)
```json
{
  "action": "stitch",
  "clips": [
    { "src": "https://...clip1.mp4", "durationInFrames": 240 },
    { "src": "https://...clip2.mp4" }
  ],
  "transition": { "type": "crossfade", "durationInFrames": 30 },
  "audioSrc": "https://...track.mp3",
  "audioVolume": 1,
  "audioLoop": false,
  "width": 1080,
  "height": 1080,
  "fps": 30
}
```

### Async mode (webhooks)
Add `webhook`, `webhookSecret`, optional `webhookEvents`, `metadata`:
- API returns `{ mode: "async", renderId }` immediately
- Callback POSTs with `X-NextCut-Signature` HMAC header
- Events: `completed`, `failed`

---

## 🧱 Layer Types (scenes mode)

| Type | Use |
|---|---|
| `solid` | Background color |
| `gradient` | Gradient backdrop |
| `text` | Titles, lyrics, captions |
| `image` | Cover art, watermark, stills |
| `video` | LTX clips, visualizers, Pexels, uploads |
| `audio` | Music/voiceover overlay |
| `shape` | Geometric overlays |
| `transition` | Scene-to-scene crossfades |
| `animation` / `animations[]` | Spring/keyframe motion |

### Media styling props (image/video layers)
`borderRadius`, `borderWidth`, `borderColor`, `objectScale` (zoom),
`objectPositionX/Y` (pan %), `opacity`.

---

## 🎞️ Stitch Transitions

`crossfade`, `slide-left`, `slide-right`, `slide-up`, `wipe-left`, `wipe-right`

---

## 🤖 AI B-Roll (Pexels — built-in) ✅ VERIFIED 2026-05-29

**B-roll is exposed as a layer type inside `/api-render`** — NOT a separate endpoint.
We probed `/api-broll`, `/api-pexels`, `/api-stock`, `/api/flows/run` etc. — all returned `404 NOT_FOUND`. Only `/api-render` exists publicly.

### ✅ Working call shape
```json
{
  "scenes": [{
    "startFrame": 0,
    "endFrame": 150,
    "layers": [
      { "type": "broll", "props": { "query": "city traffic timelapse", "source": "pexels" } }
    ]
  }],
  "width": 1080,
  "height": 720,
  "fps": 30
}
```

### Verification (size comparison @ 30 frames render)
| Layer type | Output size | Conclusion |
|---|---|---|
| `solid` (red) | 47 KB | baseline |
| `broll` query="qqzzxxnotarealthing9999" | 478 KB | Pexels fetched (graceful fallback on nonsense) |
| `broll` query="city traffic timelapse" | **735 KB** | Real Pexels footage rendered |

✅ **No Pexels API key required.** NextCut handles Pexels search + injection internally.
✅ Even nonsense queries return footage (graceful fallback).
✅ Cost is flat (~$0.0015 per render regardless of b-roll usage).

---

## 🔄 Flows (multi-step pipelines)

From homepage: chain upload → transcribe → b-roll → render in one API call with conditional branching + parallel processing.

Trigger: `POST /api/flows/run`

---

## 📦 Other Capabilities (homepage-confirmed)

| Feature | Status | Notes |
|---|---|---|
| Render (scenes / templates / stitch) | ✅ Available | Confirmed working from our test |
| Stitching | ✅ Available | `action: stitch` |
| Transcription + auto-captions | ✅ Available | SRT export, burn subtitles, TikTok-style |
| AI B-Roll (Pexels) | ✅ Available | `nextcut.broll(...)` |
| Asset Storage | ✅ Available | Upload + CDN delivery |
| Webhooks | ✅ Available | HMAC-signed callbacks |
| Job control (poll/cancel/retry) | ✅ Available | Full observability |
| Annotations & overlays | ✅ Available | Text overlays, lower thirds |
| Data streams | ✅ Available | Pipe data into templates |
| Visual Workspace editor | ✅ Available | Browser-based preview/config |
| MCP Server (AI agents) | ✅ Available | All plans incl. Free |
| AI Voiceover | 🚧 Coming Soon | Not yet shipped |

---

## 📡 Response Codes

| Code | Meaning |
|---|---|
| 200 | Render complete |
| 202 | Accepted, still processing — use `renderId` + `bucketName` to poll via Remotion Lambda SDK |
| 400 | Invalid body |
| 401 | Bad/missing API key |
| 403 | Plan limit (e.g., resolution exceeded) |
| 429 | Rate limit (10/min) |
| 500 | Lambda crash — auto-retries 3x, returns `retryable: true` |

---

## ✅ Verified Live Test (2026-05-29)

- Render at 1080×720, 30fps, 5 frames → **success**
- Render time: **19.4 seconds**
- Cost: **$0.00151** (~$0.0003/sec output)
- Output URL valid on S3 (`remotionlambda-useast1-rdqm2pvpse`)

---

## 🏗️ Base Station Integration Plan

```
Track + scene prompts
   ↓
Stage 1 — Generate clips in parallel
   ├─ LTX (existing — generateVideoLTX)
   ├─ Visualizers (existing — generateVisualizer)
   ├─ Pexels b-roll (NextCut native — nextcut.broll)
   └─ User uploads (existing UserAsset)
   ↓
Stage 2 — composeVideoNextCut (NEW)
   POST /api-render with action: "stitch"
   ├─ clips[] = Stage 1 outputs
   ├─ transition: crossfade
   ├─ audioSrc: user's track URL
   └─ webhook → nextcutWebhook (NEW, optional for long renders)
   ↓
Final MP4 saved to UserAsset
```

### Functions to build (in order)
1. **`composeVideoNextCut`** — wraps stitch mode, handles starter-tier dimension caps
2. **`searchNextcutBroll`** — wraps b-roll endpoint (once we have the exact path)
3. **`assembleMusicVideo`** — orchestrator: track → scenes → fan out gen → compose
4. **`nextcutWebhook`** — async completion handler (only if needed for long renders)