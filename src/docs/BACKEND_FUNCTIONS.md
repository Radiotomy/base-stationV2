# BASE Station — Backend Functions

Each function is an HTTP handler at `base44/functions/<name>/entry.ts`, running
on Deno. Shared logic lives in `base44/shared/` and is imported — never copied.

---

## 1. Anatomy

```ts
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    // …work…
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

Conventions:

- Secrets only via `Deno.env.get(...)`. Validate the shape when a malformed value
  would fail confusingly — e.g. `v3Model()` rejects a Replicate model string with
  no `/`, because a misconfigured secret otherwise surfaces as a third-party 404.
- Every user-supplied URL goes through `assertSafeUrl` from `shared/safeUrl.ts`.
- Return `Response.json(...)` with a meaningful status. Errors are messages, not
  stack traces.
- Anything that spends money or a platform token checks
  `user.role === 'admin'` **server-side**.

## 2. Catalogue by domain

### Watermarking — BASE Mark
| Function | Role |
| --- | --- |
| `applyBaseMark`, `autoBaseMark` | Embed the V1 spectral layer (manual / automatic) |
| `detectBaseMark` | V1 blind detection |
| `embedBaseMarkV2`, `autoBaseMarkV2` | Start the V2 neural embed (async) |
| `pollBaseMarkV2`, `replicateV2Webhook` | The two V2 completion paths → one shared finalize |
| `detectBaseMarkV2` | V2 detection, phase-shift decoding for crop robustness |
| `testBaseMarkV3`, `inspectBaseMarkV3` | Admin: V3 survival test (stepped cursor) and schema inspection |
| `deepScanBaseMark` | Curated exact-ratio re-timing search for desynchronised audio |
| `rescanAssetMark`, `pollRescanAssetMark` | Re-scan an existing asset |
| `verifyBaseMark` | **Public** black-box verifier — outcome + registry match only |
| `lookupBaseMark` | **Public** payload → registry resolution across V1 and V2 |
| `benchmarkBaseMark` | Admin: measured robustness sweep → `BaseMarkBenchmark` |
| `smokeBaseMarkV2`, `smokeBaseMarkCascade`, `cleanupBaseMarkV2` | Test & maintenance |
| `replicateBaseMark` | Admin-gated Replicate model management (`run` is admin-only) |

### Ownership, provenance & chain
`calculateCos` · `getCosManifest` · `exportDdex` · `registerOnBase` ·
`pinToIPFS` · `generateTrackCertificate` · `runBlockchainAudit` ·
`getBlockchainWalletStats` · `editID3Tags` · `extractAudioMetadata`

### Generation
Music: `generateMusic`, `generateMusicHarmonix`, `generateMusicFinetune`,
`extendUploadedMusic`, `processMusicEdits`, `tempolorExtendSong`
Lyrics: `generateLyrics`, `generateLyricsPro`, `_lyricsGenreCraft`,
`lookupWriterStyle`
Audio post: `generateStems`, `generateMashup`, `generateHarmonies`,
`generateCoverSong`, `masterTrack`, `aiMastering`, `generate243Masters`,
`applyAudioEffects`, `sonicAnalyze`, `exportMidi`
Other media: `generateCoverArt`, `generateCoverArtTiered`, `generateSoundEffect`,
`generateLoopSample`, `polishLoopAudio`, `generateVisualizer`,
`generateVideoStoryboard`, `composeVideoShotstack`, `renderShotstackEdit`,
`searchPexelsPreview`, `generateSocialCard`
Video (LTX): `generateVideoLTX` — text mode tries the **self-hosted BASE Station
LTX Engine** first (`shared/privateLtx.ts`; synchronous, returns a persisted
`video_url`, writes job/asset/credits inline) and falls back to the public LTX
API (async `job_id`, finalized by `pollGenerationJob`). Image and audio modes
are public-API only. See `src/docs/ltx-engine/README.md`.
Self-hosted music engines: `generateMusicSirenSong`/`pollSirenSongJob`,
`generateMusicSkye`/`pollSkyeJob`, `generateCodaEdit`/`pollCodaEditJob`
(Coda edit tasks); `generateMusicHarmonix` submits to Coda.
Lead sheet: `saveLeadSheet`, `generateVocalsDiffSinger`/`pollDiffSingerVocals`
(Cantor), `listDiffSingerVoicebanks`, `generateBedMusicGenChord`/
`pollMusicGenChordBed` (Cadence)
Voicebanks: `ingestDiffSingerVoicebank`/`pollVoicebankInstall` — hand a zipped
OpenUtau DiffSinger bank (or, admin-only, a shared vocoder) to the Cantor Space's
`/install`, which validates the ONNX inputs and test-sings it before keeping it.
Ownership lives in the `Voicebank` entity; `shared/voicebankAccess.ts` is the
single rule for who may see and render with a bank (platform default vs a
creator's private upload), applied by both the list and the render function.
Stems: `separateStemsSever`/`pollSeverStems` (Sever), `finalizeLocalStems`
(on-device ONNX results). The Tempolor separation path (`generateStems`,
`pollTempolorStems`, `shared/tempolorStems.ts`) was removed Sep 2026; historical
`provider: 'tempcolor'` rows with `action: 'stem_separation'` are read-only.
Loops: `embedLoopSemantic`, `backfillLoopEmbeddings`, `searchLoopsSemantic`
(CLAP), `registerLoopProvenance`
Voice: `synthesizeVoice`, `createSonicVoice`, `createMusicFinetune`,
`getMusicFinetunes`, `deleteMusicFinetune`

### Jobs, credits & providers
`pollGenerationJob` · `autoPollStuckJobs` · `sendJobNotification` ·
`deductCredits` · `getUserCredits` · `purchaseCredits` · `adminAdjustCredits` ·
`checkProviderBalance` · `refreshProviderBalances` · `checkProviderHealth` ·
`persistExternalMedia` · `getWavUrl` · `proxyAudioAsset` ·
`streamAudioForProvider`

### Live & fan economy
`createLiveSession` · `joinLiveSession` · `leaveLiveSession` ·
`canPublishToSession` · `addCoPerformer` · `triggerLiveDrop` · `awardLiveXP` ·
`awardQuestProgress` · `recordLiveSession` · `getLiveSessionSummary` ·
`publishLiveSessionBundle` · `archiveLegacySessions` · `createPortalRoom` ·
`liveAIAgent` · `createFanClub` · `updateFanClub` · `getFanClubForCreator` ·
`joinFanClubTier` · `createCollectible` · `claimCollectible` ·
`getCollectiblesForCreator` · `mintCollectibleToAudius` ·
`syncAudiusCollectibles` · `rewardFans` · `logFanAction` · `processTip` ·
`getCreatorRevenue` · `getCreatorStoreData` · `notifyFansLiveStart` ·
`notifyFansTrackDrop`

### Streamr (live audio transport)
`streamrAvailability` · `streamrAcquireStream` · `streamrPublisher` ·
`streamrSubscriber`

### Audius & external catalogue
`getAudiusTrending` · `getAudiusTrack` · `getAudiusArtist` · `searchAudius` ·
`audiusClient` · `publishToAudius` · `importAudiusStems` · `syncAudiusIdentity` ·
`searchFreesoundSounds` · `importFreesoundSound` · `radioFeed` · `radioQueue` ·
`buildRadioPlaylist` · `refreshPlaylists`

### Community, ops & admin
`forumApi` · `verifyTrackSource` · `autoActivateChallenges` ·
`logTrackGeneratedActivity` · `trackAnalytics` · `getAnalyticsSummary` ·
`logError` · `runSmokeTests` · `updateAIMusicNews`
(NextCut probes are retired — video composition runs on Shotstack.)

### Webhooks
`replicateV2Webhook` · `tempolorWebhook` · `aimusicapiWebhook` — all HMAC-verified
before the payload is trusted, and all routed into the same shared finalize
modules the pollers use.

## 3. Auth tiers

| Tier | Functions |
| --- | --- |
| **Public (no auth)** | `verifyBaseMark`, `lookupBaseMark`, `getAudius*`, `searchAudius`, `radioFeed`, `radioQueue`, `streamAudioForProvider` |
| **Authenticated user** | The overwhelming majority — generation, jobs, credits, live, fan economy |
| **Admin only** | `benchmarkBaseMark`, `testBaseMarkV3`, `inspectBaseMarkV3`, `replicateBaseMark` (`run`), `updateAIMusicNews`, `probeNextcutBroll`, `adminAdjustCredits`, `runBlockchainAudit`, `runSmokeTests` |
| **Webhook (signature)** | The three provider webhooks |

The public verifier is intentionally unauthenticated — a rights-holder checking a
snippet must not need an account — and is intentionally a black box: it returns a
detection outcome and a public registry match, never a correlation strength or a
threshold.

## 4. Adding a function

1. Does a shared module already do this? Import it rather than reimplementing.
2. Needs a secret? Declare the secret **first**, then write code that reads it.
3. Will it exceed the request budget? Design it as start → persist → finalize
   from the beginning (see `ARCHITECTURE.md §4`), not as a blocking wait.
4. Decide the auth tier explicitly and enforce it in the handler.
5. Test it with the platform's function test tool before wiring UI to it.
6. If it should run on a schedule or an entity event, add a workflow in
   `base44/workflows/` — don't build a client-side timer to fake it.

## 5. Known gap

Several public read-through functions (`getAudius*`, `searchAudius`,
`radioFeed`, `radioQueue`, `streamAudioForProvider`) are unauthenticated by
design but currently unthrottled. If quota abuse becomes an issue, rate limiting
belongs in these handlers rather than in the client.