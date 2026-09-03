# Sonic / AIMusicAPI — Official Error Reference

Source: https://docs.aimusicapi.ai (official error handling page)

---

## 📋 Full documentation audit — 2026-09-03 (docs.aimusicapi.ai/llms.txt)

### Platform status
| Product | Status | BASE Station |
|---|---|---|
| **Sonic** (v3.5 → v5.5) | Active | Primary provider — `generateMusic`, `generateCoverSong`, `extendUploadedMusic`, `generateMashup`, `createSonicVoice`, `sonicAnalyze`, `exportMidi`, `getWavUrl` |
| **Nuro** | **Deprecated — HTTP 410 Gone** on create and task polling | Auto-redirected to Sonic/Tempolor in `generateMusic`; poll branch returns a failure message |
| **Riffusion** | Deprecated | Never integrated |
| **Producer** | Active upstream (10 cr, music + lyrics + video clip) | Retired here by decision — Sonic + Tempolor + ElevenLabs cover all cases |

### Contract changes applied in this audit
| Change | Where |
|---|---|
| `use_suno_cdn` is now **required** on `POST /sonic/create` (400 without it). We send `false` so files come from aimusicapi's CDN. | `generateMusic`, `extendUploadedMusic` |
| `duration` (integer **10–360 s**) supported on create / persona / extend / cover / upload-extend / upload-cover. Target, not hard cut. Sending it on any other task type → validation error. | `generateMusic`, `generateCoverSong`, `extendUploadedMusic` |
| `vocal_gender` `'f'|'m'` — v4-5, v4-5-plus, v5, v5-5 only | `generateMusic` (+ new Advanced tab controls) |
| `negative_tags`, `style_weight`, `weirdness_constraint`, `make_instrumental` on create | `generateMusic` |
| `sonic-v4-5-all` is **not** in the create enum (sample/mashup only) → mapped to `sonic-v4-5`; removed from the picker | `generateMusic`, `musicModelCatalog` |
| Default model is `sonic-v5` (was falling back to v4-5 in two places) | `generateMusic`, `jobFinalize` |
| auto_concat tasks return **paired** `{extended|replaced, full}` objects; `full` is the deliverable, `null` while concat runs | `jobFinalize.pollProvider`, `aimusicapiWebhook` |
| `POST /sonic/midi { clip_id }` → `{ midi_url, instruments[{name, notes[]}] }` (1 cr). The `/sonic/export-midi` call we made **did not exist**. | `exportMidi`, `MidiExportButton` now passes `clip_id` |
| `POST /sonic/download { clip_id, formats[] }` (2 cr, mp3/m4a/wav, `202` = preparing, free retry, `404` = source purged) replaces `/wav` as the recommended path. `/wav` (1 cr) kept as finalize-time fetch + fallback. | `getWavUrl`, `jobFinalize` |
| `POST /sonic/vox { clip_id, vocal_start_s?, vocal_end_s? }` (≤30 s range, 1 cr) | `sonicAnalyze` action `vox` |
| Routing: Sonic handles up to 6 min via `duration`; Tempolor only for >360 s | `providerRouter` |

### Upstream credit changes (Credits Usage Guide)
| Operation | Old | **Now** |
|---|---|---|
| Create / Cover / Mashup / Sample on **advanced models** (v4.5, v4.5+, v5, v5.5) or **description mode** (any model) | 10 | **14** |
| Create on v3.5 / v4, custom lyrics | 10 | 10 |
| Extend, Persona, Remaster, Replace, Add vocals/instrumental | 10 | 10 |
| Stems basic | 10 | **20** |
| Stems full | 50 | 50 (12 tracks per API page; credits page says 24) |
| Upload / Concat / Download | — | 2 each |
| Get WAV / MIDI / BPM / VOX / Upsample / Aligned lyrics (first call) / Create persona | 1 | 1 |
| Create voice | 4 | 4 |

> Our user-facing charge is still a flat 10 BS credits per Sonic generation. With the default `sonic-v5`, every call now costs 14 upstream — see the Admin → Cost Matrix for the margin impact before deciding whether to re-price.

### Sonic capabilities NOT yet built in BASE Station
| Endpoint | Credits | Notes |
|---|---|---|
| **Remaster** — `task_type: remaster`, `variation_category: subtle|normal|high` (v5 only for category) | 10 | Clip must be ≤24 h old |
| **Replace Section** — `POST /sonic/replace-section` with `infill_lyrics`, `infill_start_s/end_s`, optional `auto_concat` | 10 | Regenerate one verse/chorus |
| **Add Vocals / Add Instrumental** — `task_type: add_vocals|add_instrumental`, `overpainting_start_s/end_s` | 10 | Uploaded clips only, ≤24 h, v4.5+/v5/v5.5 |
| **Stems basic / full** — `POST /sonic/stems/basic|full { clip_id }` | 20 / 50 | Sever + on-device already cover separation for free; only useful for Sonic-native stems |
| **Sample** — `POST /sonic/sample` (hum / clip segment → full song, `chop_sample_start_s/end_s`) | 14 | Accepts `url` for auto-upload |
| **Concat** — `task_type: concat_music, continue_clip_id` | 2 | Needed to stitch our `extend_upload_music` output into a full track |
| **Create Persona from clip** — `POST /sonic/persona { name, clip_id, describe, styles }` | 1 | Cheaper than `create-voice` (4) when the source is already a Sonic clip |
| **auto_concat** on `/sonic/upload-extend` | — | Would replace our two-step extend + manual concat |
| **Producer** (music video clips, `make_lyrics`) | 10 | Retired here by decision |

Used by these backend functions:
- `generateMusic` (Sonic provider branch)
- `generateCoverSong`
- `extendUploadedMusic`
- `sonicAnalyze`
- `pollGenerationJob` (Sonic polling branch)
- `aimusicapiWebhook`

---

## 🔹 Validation Errors (HTTP 400)

| Error Message | Trigger | Field We Send |
|---|---|---|
| `The 'mv' field is invalid. The model should be 'chirp-v3-5','chirp-v4' or 'chirp-v4-5'.` | Unknown model | `mv` (we map sonic-v* → chirp internally) |
| `The 'persona_id' field is required when task_type = persona_music.` | persona_music task without persona_id | `persona_id` |
| `The 'make_instrumental' field should be boolean.` | Wrong type | `make_instrumental` |
| `The 'custom_mode' field should be boolean.` | Wrong type | `custom_mode` |
| `The prompt character length should be less than 3000.` | Lyrics too long on v3.5/v4 | `prompt` |
| `The 'gpt_description_prompt' character length should be less than 200.` | AI-mode description over limit | `gpt_description_prompt` (we cap at 400 — matches Sonic Instructions spec; this 200 error msg is outdated/stale) |
| `The tags character length should be less than 200.` | Style tags too long on v3.5/v4 | `tags` |
| `The title character length should be less than 80.` | Title over limit | `title` |
| `description is required.` | Persona/upload-cover missing description | `description` |
| `The description character length should be less than 120.` | Description over limit (one endpoint) | `description` |
| `name and continue_clip_id are required fields.` | Extend without clip_id | `continue_clip_id` |
| `The name character length should be less than 80.` | Extend name over limit | `name` |
| `The description character length should be less than 200.` | Extend description over limit | `description` |
| `task not found.` | Polling unknown task_id | `task_id` |
| `missing task id.` | Polling without task_id | `task_id` |

### ✅ gpt_description_prompt = 400 chars (verified)
Sonic Instructions (https://docs.aimusicapi.ai/doc-2058749) defines the cap as **400 chars**. The error-handling page (doc-2058747) lists a 200-char error message but this appears to be stale/outdated docs. All three functions correctly cap at 400.

### ⚠️ Model name mapping
Docs list canonical models as `chirp-v3-5`, `chirp-v4`, `chirp-v4-5`. We send `sonic-v3-5` / `sonic-v4` / `sonic-v4-5` / `sonic-v4-5-plus` / `sonic-v5` / `sonic-v5-5`. Both spellings are accepted (confirmed in the mashup/sample specs, 2026-09-03). Note that poll/webhook responses report `mv` in the **chirp-** spelling (e.g. `chirp-v5`) even when we sent `sonic-v5`.

---

## 🔹 Authentication (HTTP 401)

| Message | Cause |
|---|---|
| `Authorization header is missing.` | `SONIC_API_KEY` env var unset/empty |
| `Invalid authorization format.` | Header not `Bearer <key>` |

We always send `Authorization: Bearer ${SONIC_API_KEY}` — if these fire, the secret is missing or rotated.

---

## 🔹 Forbidden (HTTP 403) — surface to user clearly

| Message | Meaning | UX Recommendation |
|---|---|---|
| `The remaining credits are not enough. You can buy more one-time credit packs or subscribe.` | **Provider credits exhausted** (not our user credits) | Admin alert — check `ProviderBalance` entity, top up Sonic account |
| `You do not have an active subscription. Please check whether your renewal was successful.` | Sonic subscription lapsed | Admin alert |
| `The lyrics format is invalid. Please check and try again.` | Bad `[Section]` tags or malformed structure | Show "Lyrics format invalid — check your [Verse]/[Chorus] tags" |
| `The lyrics contain copyrighted content: 'specificError'. Please use original lyrics.` | Detected copyrighted lyrics | Show error verbatim — `'specificError'` names the snippet |
| `The lyrics contain inappropriate content: 'specificError'.` | Content moderation hit | Show error verbatim |
| `The song description needs moderation review.` | Description flagged for review | Surface to user — pending review |
| `The song description contains artist names: 'specificError' which is not allowed.` | Artist name in description | Show error — strip name and retry |
| `The song description contains producer tags: 'specificError' which is not allowed.` | Producer tag in description | Show error — strip tag and retry |

**Implementation note:** Pass the raw error message through to the toast/UI when status === 403. The `'specificError'` substring is the actual flagged content and is critical for the user to know what to change.

---

## 🔹 Other

| Code | Message | Meaning | Our Handling |
|---|---|---|---|
| 400 | `task not found.` | Polled an unknown task_id | Mark job failed, refund N/A (never started on Sonic side) |
| 504 | `Task failed due to timeout. Credits were previously refunded.` | Provider-side timeout, **Sonic already refunded their credits** — we should refund user credits too | Mark job failed + restore user credits |
| 500 | `Internal Server Error.` | Provider transient | Retry once, then mark failed |

---

## 🔹 Audio URL rejection (NOT in official docs but observed)

For `upload-cover` and `extend` endpoints, the file URL is also validated:

| Observed Message | Cause |
|---|---|
| `Audio URL is not accessible. Please provide a public direct audio file URL.` | URL returns non-200 on Sonic's GET, or HEAD probe fails. Common with auth-gated Base44 file URLs. |
| `Upload request failed (HTTP 400) — Invalid audio file` | URL reachable but file is not parseable audio (e.g. HTML, corrupt MP3, unsupported codec) |

**Mitigation in place:**
- `ensurePublicUrl()` in `generateCoverSong` + `extendUploadedMusic` re-hosts any `base44.app` / `preview-sandbox` URL to a public CDN before submission.
- `streamAudioForProvider` proxy handles HEAD/GET range-request quirks for any URL that slips through.

---

## 🔹 Integration checklist when touching Sonic functions

1. Validate `custom_mode`, `make_instrumental` as booleans before sending.
2. Enforce per-model `prompt` / `tags` limits via `SONIC_LIMITS` map (already in place in `generateCoverSong`, `extendUploadedMusic`).
3. Cap `gpt_description_prompt` at **400** (per Sonic Instructions spec).
4. Cap `title` at 80, `description` at 120 (or 200 for extend).
5. For 403 errors, pass `message`/`error` text through to user UI verbatim.
6. For 504 timeouts, restore user credits.
7. For 400 `task not found` during polling, fail the job — do not retry.