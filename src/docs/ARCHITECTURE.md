# BASE Station — Architecture

How the app is put together, and the reasoning behind the parts that aren't
obvious from the file tree.

---

## 1. High-level shape

```
Browser (React + Vite PWA)
  │
  ├─ base44.entities.*        read-mostly data, direct CRUD + realtime subscribe
  ├─ base44.functions.invoke  anything trusted, secret-holding, or compute-heavy
  └─ base44.integrations.*    LLM, image/speech/video generation, uploads, email
        │
Base44 backend
  ├─ Entities + row-level security      (base44/entities/*.jsonc)
  ├─ Backend functions (Deno)           (base44/functions/<name>/entry.ts)
  ├─ Shared server modules              (base44/shared/*.ts)
  ├─ Workflows (scheduled / triggered)  (base44/workflows/*.jsonc)
  └─ In-app agents                      (base44/agents/*.jsonc)
        │
External: Replicate · Tempolor · Sonic · ElevenLabs · Audius · Pinata/IPFS ·
          Base RPC · Freesound · Streamr · Shotstack · LTX · Pexels
```

**Provider posture (Aug 2026).** Tempolor is the default music-generation and
stem-separation provider; Sonic remains in place for core generation and
extension, with its migration paused pending a possible deprecation notice.
ElevenLabs is retained **only** for voice cloning, TTS and podcast voiceover — it
is not a default music generator.

## 2. The direct-CRUD vs backend-function split

This is the core architectural decision in the app.

**Direct entity access from the browser** is used when the data is
read-mostly and the correctness of a write doesn't need to be enforced beyond
what RLS already guarantees: the asset library, playlists, charts, projects,
workspaces, comments, reactions, follows, forum reads.

**A backend function is mandatory** when any of the following is true:

1. A secret is required (any provider API key, the RPC URL, the wallet key).
2. The logic itself is confidential (watermark embedding/detection, COS
   weighting). Shipping it to the client would publish the trade secret.
3. The write must be trusted — credits, XP, registry rows, chain registrations.
   A client that can freely write these can mint them.
4. It's expensive or long-running and belongs on a server.

Consequence: **no watermark math, no scoring weights and no API key exists
anywhere under `src/`.** If you find yourself needing one on the client, the
feature belongs in a function.

## 3. Shared server modules

Backend functions import from `base44/shared/`. This is deliberate and
load-bearing — the watermarking algorithm is imported by ~15 functions, and for a
forensic system, two copies that drift apart is a correctness bug, not a style
problem.

| Module | Responsibility |
| --- | --- |
| `baseMark.ts` | V1 spectral embed/detect, duration-aware thresholds |
| `baseMarkV2.ts` | V2 neural layer — payload packing, Replicate routing, polling |
| `baseMarkVerify.ts` | Unified two-layer verification funnel — spectral first, neural only when GPU is explicitly allowed |
| `basePrint.ts` | Print Layer — scale-invariant fingerprint (identification, admin-only) |
| `baseMarkSearch.ts` | Desynchronization search, curated deep-scan ratios |
| `baseMarkV2Finalize.ts` | Single completion path for V2, used by webhook **and** poller |
| `audioAttacks.ts` | Pure-DSP attack suite + synthetic test signals for benchmarks |
| `cosEngine.ts` | Creative Ownership Score computation and label derivation |
| `jobFinalize.ts`, `mashupFinalize.ts`, `rescanFinalize.ts` | Shared job completion |
| `safeUrl.ts` | URL allow-listing / SSRF guard |
| `persistMedia.ts` | Copy provider-hosted output onto our own storage |
| `flacDecoder.ts` | Server-side FLAC decode for analysis paths |
| `tempolorStems.ts` | Tempolor stem separation client, stem-label normalisation, and archive expansion |

**Rule:** logic needed by more than one function goes here. Never copy a block
between two `entry.ts` files.

## 4. Long-running jobs

GPU inference and audio processing do not fit inside a single request. A
4-minute WAV through a cold GPU measured past 300 seconds and hit the function
timeout — with the work already succeeded upstream and no way to collect it.

Every heavy path is therefore **start → persist → finalize**, never a blocking
wait:

```
1. start      function POSTs the prediction, stores prediction_id on the asset
              or GenerationJob, marks status = 'processing', returns immediately
2. finalize   whichever arrives first:
                • provider webhook  (replicateV2Webhook, tempolorWebhook, …)
                • poller function   (pollBaseMarkV2, pollGenerationJob, …)
              both call the SAME shared finalize module
3. rescue     the "Auto-Poll Stuck Generation Jobs" workflow sweeps anything
              left processing; the notification bell also drives a poll for jobs
              older than 90s whose studio page was closed
```

Some tests are stepped even further — `smokeBaseMarkCascade` takes an action
(`start` / `poll`) and advances one step per call, because a full encode *and*
decode of a master exceeds one request no matter how it's arranged. Its poll step
is also the cascade's correctness proof: it re-runs BOTH detectors against the
final combined file and asserts each still resolves to the same payload.

**Retired path.** The V3 drift layer and its seven backend functions, shared
modules, slot entity and Replicate deployments were removed in August 2026 (see
`BASE_MARK_V3_ARCHIVE.md`). Nothing under `base44/` should reference `baseMarkV3`
or `BaseMarkV3Slot`; if it does, it is dead code.

**Treat the execution budget as an architectural input, not an annoyance.**

**Stem separation** follows the same shape with one extra step: Tempolor returns
a multi-stem archive, so `pollTempolorStems` expands it server-side (`fflate`),
uploads each stem's bytes to our own storage rather than trusting provider URLs,
normalises filenames, and creates one `UserAsset` per stem with
`parent_asset_id` pointing at the source. Credits are deducted once, on the
finalize step. Large archives are the memory-pressure risk on this path.

## 4a. BASE Foundry (client-side module)

The Foundry is the one significant subsystem that is deliberately **not** on the
server: a node-graph DSP engine owning its own `AudioContext`, isolated from the
mastering chain, the BASE Mark path and every COS module. A patch is a *tool*,
never a recording — it carries its own design participation score, which must
never be blended with an audio COS, and it never enters the forensic attribution
path. Its only backend piece is `foundryGenerateGraph` (prompt → graph). Phase 8
added read-only analyser taps on a patch's LFO/envelope outputs so Visualizer
Studio can be driven by modulation instead of amplitude; the tapped patch runs
muted and touches no other audio graph. Full rules: `FOUNDRY_MODULE.md`.

## 5. Workflows

Sixteen workflow definitions in `base44/workflows/` cover everything
time-driven or event-driven:

- **Entity-triggered:** auto BASE Mark V2 on new audio assets, persist new asset
  media, persist submitted track media, notify fans on track drop, notify fans
  when an artist goes live, notify user on job completion, log generated
  track/loop to community buzz
- **Scheduled:** auto-poll stuck generation jobs, auto-activate challenges,
  provider balance refresh, AI music news refresh (3×/day), daily + monthly
  blockchain audit, weekly legacy session archival

Workflows call backend functions; they don't contain business logic themselves.

## 6. Realtime

`base44.entities.X.subscribe()` drives the live layer end to end:
`useLiveEventBus` (session events), `useSyncPlayback` (playback alignment across
viewers), chat with moderation, reaction bar, participant list, quest progress,
drop overlays. It also powers the community activity feed and the asset library's
live updates in the creator dashboard.

Subscriptions must always return their `unsubscribe` from the effect. A leaked
subscription accumulates handlers and shows up as a multi-second
`'message' handler took …ms` violation in the console.

## 7. Frontend structure

- **Routing** — `src/App.jsx` owns every route. Pages are `React.lazy`, so a
  route only downloads its own chunk. Public and protected surfaces are split by
  nesting under `ProtectedRoute`; `AdminGate` and `BetaGate` wrap the narrower
  ones. Adding a page means adding both the lazy import and the `<Route>`.
- **Design system** — all colour, radius and font values are CSS custom
  properties in `src/index.css`, mapped to Tailwind classes in
  `tailwind.config.js`. Write `bg-card`, not `bg-[#241C14]`. The "Liquid Mercury"
  override block re-skins legacy hardcoded palette classes globally — prefer
  tokens in new code so it doesn't need to.
- **Tailwind purge** — class names must appear as literal strings in source. A
  computed name (`` `bg-${color}-500` ``) is purged and vanishes silently.
- **Mobile** — `src/components/layout/MobileLayout.jsx` plus a `≤640px` block in
  `index.css` (touch-action rules, type scaling, safe areas) and a `≤820px`
  performance mode that disables backdrop blur and infinite gradient animations,
  which are very expensive on mobile GPUs.
- **Service worker** — `public/sw.js` caches *only* immutable build output
  (`/assets/**`, icons, manifest). It never intercepts navigations, API traffic
  or cross-origin requests, and every code path returns a real `Response`.
  Intercepting navigations previously produced
  `Failed to convert value to 'Response'` and made page loads fail outright.

## 8. Security model

| Concern | Control |
| --- | --- |
| Cross-user data access | Row-level security declared per entity, not UI filtering |
| Trade-secret logic | Server-only modules in `base44/shared/` |
| SSRF | `assertSafeUrl` on every user-supplied URL; proxies re-validate host across redirects manually |
| Spend abuse | Admin role checked **inside** any function that spends a platform token or wallet balance |
| Webhook forgery | HMAC signature verified before the payload is trusted |
| Model drift | Replicate versions pinned by digest so a `cog push` can't silently change watermarking |
| False attribution | Evidence-scaled thresholds; the detector abstains rather than guesses |

## 9. Observability

- `ErrorLog` entity + `logError` function, with an admin viewer at
  `/dev/error-log`
- `runSmokeTests` plus frontend smoke runners at `/dev/smoke-tests`
- Live regression and multiclient harnesses under `/dev/`
- `BaseMarkBenchmark` entity holding measured per-attack survival rates,
  produced by `benchmarkBaseMark`
- `APIUsageLog` for per-user provider/credit accounting