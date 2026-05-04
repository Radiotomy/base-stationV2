# Base Station: Master AI Music Integration Plan
*Last updated: 2026-05-04 — audited against live codebase*

---

## Status Legend
- ✅ Complete & in production
- 🔲 Not started
- ⚠️ Partial / needs attention

---

## PHASE 1 — Core Studio Polish ✅ COMPLETE

### Studio Infrastructure
- ✅ `QuickGenerateTab` — AI param auto-routing (genre, mood, BPM, duration, title, needs_lyrics)
- ✅ `AdvancedGenerateTab` — full provider/model/lyrics control
- ✅ `ChipSelector` — reusable with custom chip support (DB-persisted via `CustomChip` entity)
- ✅ `MusicStudio` — tab-based layout wrapping both tabs
- ✅ `LyricsStudio` — rhyme schemes, structure templates, version history, save to library
- ✅ `CoverArtStudio` — presets + custom prompt, variation gallery
- ✅ `VideoStudio` — text/image/audio to video via LTX, version history
- ✅ `AudioRemixStudio` — stem extraction, VOX tools, remaster, replace section, waveform visualizer

### Generation Quality & Safety
- ✅ Duplicate generation guards (`generating` flag + `status === 'processing'` check)
- ✅ Auto-save: primary track only — no loops over `audio_urls` array
- ✅ `savedRef` prevents duplicate `onComplete` callbacks during polling
- ✅ Cover art auto-generated post-track in both Quick and Advanced tabs
- ✅ MIDI export (`exportMidi` backend function + `MidiExportButton` component)
- ✅ Job polling with 15s interval (per Sonic docs recommendation), `completedRef` guard
- ✅ Debounced inputs via `useDebouncedValue` hook
- ✅ Keyboard shortcut `⌘+Enter` via ref (no re-registration on keystrokes)
- ✅ `generateRef.current = generate` placed after `generate` declaration (ReferenceError fix)
- ✅ `pending` status included in `isProcessing` guard

### Backend Functions
- ✅ `generateMusic` — Sonic, Nuro, Producer, Tempolor, Loudly
- ✅ `generateLyrics` — AI Music API sonic/lyrics + LLM (Claude Sonnet) fallback
- ✅ `generateVideoLTX` — LTX text/image/audio to video
- ✅ `generateCoverArt` / `generateCoverArtTiered`
- ✅ `pollGenerationJob` — all providers, recovery via list/feed fallback
- ✅ `processMusicEdits` — stems, remaster, vox_isolate, vox_remove, vox_enhance, replace_section
- ✅ `editID3Tags` — embed title/artist/BPM/key/copyright/TXXX/cover art in MP3
- ✅ `exportMidi` — MIDI generation from audio metadata

---

## PHASE 2 — Secure & Extensible AI Content Logging ✅ COMPLETE

### APIUsageLog Standardization
- ✅ Unified `metadata` schema across all functions:
  `model_version`, `input_parameters`, `output_details` (URLs, BPM, key), `provider_job_id`, `base44_job_id`, `generated_timestamp`, `content_hash`
- ✅ `generateMusic` — pending log on request, finalized on sync (Loudly) with full output details
- ✅ `pollGenerationJob` — finalizes pending log on async completion for all providers; computes `content_hash`
- ✅ `generateLyrics` — logs provider (aimusicapi vs llm_fallback), model, rhyme scheme, lyrics hash
- ✅ `processMusicEdits` — logs task type, provider, input/output URLs, content hash
- ✅ All logging uses `base44.asServiceRole` (secure, admin-level, permission-independent)
- ✅ `content_hash` SHA-256 fingerprint on every log entry
- ✅ `AdminAIIntegrations` dashboard — provider balances, usage charts, filterable log table, CSV export

---

## PHASE 3 — Provider Routing Intelligence ✅ COMPLETE

- ✅ `utils/providerRouter.js` — centralized routing matrix
- ✅ Routing rules:
  - Duration > 120s → Tempolor (only provider supporting up to 5 min)
  - Vocal/lyrics → Nuro v2.0 (best vocal fidelity)
  - Multiple variations → Sonic v5-5
  - Speed priority → Loudly VEGA_2 (synchronous, no polling)
  - General purpose → Sonic v4-5-plus
- ✅ `QuickGenerateTab` exposes routing decision badge: provider + model + reason
- ✅ Manual override toggle (collapses/expands provider grid)
- ✅ Fallback chain: primary fails → tries next best providers in order
- ✅ `routing_reason` passed to `APIUsageLog.metadata` + logged as `fallback_from_<provider>` on fallback
- ✅ `PROVIDER_DETAILS` map shared between frontend + routing utils
- ✅ Lyrics: routes to AI Music API sonic/lyrics first, falls back to Claude Sonnet (credit cost warning shown)

---

## PHASE 4 — Audio Separation & Remix Upgrades ⚠️ PARTIAL

### Done
- ✅ `AudioRemixStudio` — tiered stem extraction (Sonic full/4-stem via `processMusicEdits`)
- ✅ VOX tools: `vox_isolate`, `vox_remove`, `vox_enhance` via Sonic endpoints
- ✅ Track extension via Tempolor (up to 5 min) — exposed in both Quick and Advanced tabs
- ✅ Remaster via Sonic remaster endpoint
- ✅ Replace section via Sonic replace section
- ✅ All operations logged via `processMusicEdits` log pattern

### Not Started
- 🔲 Tiered stem UX: Basic (2–4 track, Loudly or Tempolor) vs Advanced (12-track, Sonic) — UI selector not built
- 🔲 Loudly Remixer API integration — investigate availability + integrate

---

## PHASE 5 — Loops & Samples Studio 🔲

- 🔲 New page: `/loops-studio`
- 🔲 Generate loops (4–32 bars) via Loudly Sample Packs API + Sonic
- 🔲 BPM-locked and key-locked loop generation
- 🔲 Loop category chips: Drum Loop, Bassline, Melody, FX, Pad, Vocal Chop
- 🔲 Loop preview player (HTML5 `loop` attribute)
- 🔲 Save to `UserAsset` as `asset_type: "loop"` with BPM/key metadata
- 🔲 Pack builder → save as `asset_type: "project"`
- 🔲 Surface in Creator Dashboard under new "Loops" library tab

---

## PHASE 6 — Intelligent Mastering Studio 🔲

- 🔲 New page: `/mastering-studio`
- 🔲 Upload → `extractAudioMetadata` → display BPM, key, loudness, duration
- 🔲 Mastering presets: Streaming (−14 LUFS), Club (−9 LUFS), Radio (−16 LUFS), Vinyl, Lo-Fi
- 🔲 Apply mastering via `applyAudioEffects` (normalize, EQ, compression)
- 🔲 Sonic remaster as primary AI mastering provider
- 🔲 Before/After A/B player (toggle original vs mastered)
- 🔲 Download mastered file + save to library
- 🔲 Log mastering session

---

## PHASE 7 — Creator Dashboard Upgrades 🔲

### Partially Built (needs wiring)
- ⚠️ `CreatorDashboard` exists — tabs for library, projects, submissions, history
- ⚠️ `GenerationHistoryTab` and `ProjectsTab` components exist but analytics not fully wired to `APIUsageLog`

### Not Started
- 🔲 Real usage stats from `APIUsageLog`: tracks generated, credits spent, providers used
- 🔲 Per-track analytics: plays, saves, downloads
- 🔲 Re-generate button from generation history (with exact model/provider from log)
- 🔲 Project workspace: link track + lyrics + cover art + video into one `Project` entity
- 🔲 Export full project as ZIP (track + art + lyrics .txt + metadata .json)
- 🔲 Generation provenance badge: "Made with Sonic v5-5 on [date]"

---

## PHASE 8 — Community & Discovery ⚠️ PARTIAL

### Done
- ✅ `TrackComments`, `TrackReactions` components built
- ✅ `FeaturedArtists` page
- ✅ `Challenges` page + `ChallengeCard`, `SubmitChallengeModal`
- ✅ `Leaderboard` page with XP system
- ✅ `Follow` entity + `FollowButton` component
- ✅ `ActivityFeed` component
- ✅ `CommunityTemplates` page — prompt template library

### Not Started
- 🔲 Weekly challenge auto-activation via scheduled automation
- 🔲 Community template library surfaced prominently on Home page
- 🔲 Track provenance badge on public submissions ("Made with Sonic v5-5")
- 🔲 Follow activity feed fully wired to entity subscription

---

## PHASE 9 — Monetization Layer ⚠️ PARTIAL

### Done
- ✅ `UserCredit` + `CreditLog` entities
- ✅ `CreditBalanceWidget` in header
- ✅ `Credits` page — balance, purchase modal, usage history
- ✅ `Tip` entity + `TipModal` component (fiat via Stripe + Base chain)
- ✅ `deductCredits`, `getUserCredits`, `purchaseCredits` backend functions
- ✅ `processTip` backend function

### Not Started
- 🔲 Credit cost wired to actual generation calls (deduct on success)
- 🔲 Credit cost shown per provider selection in `AdvancedGenerateTab`
- 🔲 Premium tier gating (lock Sonic v5-5, Producer, Nuro behind credit threshold)
- 🔲 Revenue dashboard for artists

---

## PHASE 10 — Mobile & PWA ⚠️ PARTIAL

### Done
- ✅ `MobileNav` — bottom nav bar (Home, Music, Lyrics, Video, Radio, Charts)
- ✅ `MobileLayout` — flex column wrapper with `<Outlet />`
- ✅ Responsive design on all studio pages
- ✅ `public/manifest.json` exists

### Not Started
- 🔲 Full mobile layout audit across all studios (waveform editor, chip selectors on small screens)
- 🔲 Service worker / offline asset library browsing
- 🔲 Touch-optimized waveform interactions
- 🔲 PWA install prompt

---

## Technical Debt / Drift Notes

1. **`pages/AIStudio`** — original lightweight AI tool hub (lyrics/prompt builder/cover art via LLM only). Now largely superseded by dedicated studios (`LyricsStudio`, `CoverArtStudio`, `MusicStudio`). Should either be retired or redirected.
2. **`cacheManager`** — fully implemented (memory + localStorage, TTL). Used in `QuickGenerateTab` for AI param caching. Could be extended to cache polling results.
3. **`generateLyricsNuro` + `generateMusicNuro`** — standalone Nuro-specific functions exist alongside the unified `generateMusic`. Should be consolidated — `generateMusic(provider: 'nuro')` is the canonical path.
4. **`refreshProviderBalances`** — function exists but scheduled automation not confirmed as active. Verify hourly cron is running.

---

## Recommended Next: Phase 5 (Loops Studio) or Phase 7 (Creator Dashboard Analytics Wiring)

**Phase 5** delivers a new creative surface (loops/samples) with clear user value.  
**Phase 7** delivers trust and transparency — users see their generation history with provenance and can re-generate from history.

Phase 7 is recommended first as it has the most existing scaffolding to build on.