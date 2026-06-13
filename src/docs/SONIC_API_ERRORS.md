# Sonic / AIMusicAPI — Official Error Reference

Source: https://docs.aimusicapi.ai (official error handling page)

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
| `The 'gpt_description_prompt' character length should be less than 200.` | AI-mode description over limit | `gpt_description_prompt` (we cap at 400 — **VERIFY: docs say 200**) |
| `The tags character length should be less than 200.` | Style tags too long on v3.5/v4 | `tags` |
| `The title character length should be less than 80.` | Title over limit | `title` |
| `description is required.` | Persona/upload-cover missing description | `description` |
| `The description character length should be less than 120.` | Description over limit (one endpoint) | `description` |
| `name and continue_clip_id are required fields.` | Extend without clip_id | `continue_clip_id` |
| `The name character length should be less than 80.` | Extend name over limit | `name` |
| `The description character length should be less than 200.` | Extend description over limit | `description` |
| `task not found.` | Polling unknown task_id | `task_id` |
| `missing task id.` | Polling without task_id | `task_id` |

### ⚠️ Discrepancy to verify
Our `SONIC_LIMITS` constants currently set `gpt_description_prompt` to 400 chars, but docs say **200**. Verify against current API before next push — affects `generateCoverSong`, `extendUploadedMusic`, `generateMusic` AI-description mode.

### ⚠️ Model name mapping
Docs list canonical models as `chirp-v3-5`, `chirp-v4`, `chirp-v4-5`. We send `sonic-v3-5` / `sonic-v4` / `sonic-v4-5` / `sonic-v4-5-plus` / `sonic-v5` / `sonic-v5-5`. If a future API tightening rejects `sonic-*` aliases, map them server-side in each function's request builder.

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
3. Cap `gpt_description_prompt` at **200** (not 400 — fix pending verification).
4. Cap `title` at 80, `description` at 120 (or 200 for extend).
5. For 403 errors, pass `message`/`error` text through to user UI verbatim.
6. For 504 timeouts, restore user credits.
7. For 400 `task not found` during polling, fail the job — do not retry.