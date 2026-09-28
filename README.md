<div align="center">

# BASE Station

**The provenance-first AI music studio.**

Generate, remix and master music with AI — then walk away with a forensically
watermarked master, a scored ownership manifest, and on-chain proof that the
work is yours.

[Live app](https://base-station.base44.app) ·
[Public watermark verifier](https://base-station.base44.app/verify) ·
[In-app docs](https://base-station.base44.app/docs) ·
[Audiotool Bridge](https://base-station.base44.app/audiotool)

</div>

---

## Table of contents

- [What this is](#what-this-is)
- [Why it exists](#why-it-exists)
- [Feature overview](#feature-overview)
- [The provenance stack](#the-provenance-stack)
- [Audiotool Bridge](#audiotool-bridge--live-daw-peer)
- [Live Studio](#live-studio--realtime-performance-beta)
- [Video Studio](#video-studio--music-video-composition-beta)
- [Roadmap](#roadmap)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Backend secrets](#backend-secrets)
- [Deploying](#deploying)
- [Documentation](#documentation)
- [Security policy](#security-policy)
- [Licence & attribution](#licence--attribution)

---

## What this is

BASE Station is a production web app (installable PWA) for AI-assisted
musicians. It bundles roughly twenty purpose-built studios — music generation,
lyrics, stems, mashups, vocal harmonies, mastering, cover art, SFX, loops,
visualizers, video, voice personas — with a community layer (radio, charts,
challenges, live sessions, fan clubs, forum) and, underneath all of it, a
provenance pipeline that runs automatically on every audio asset a creator
saves.

It is built on [Base44](https://base44.com) as its backend-as-a-service: auth,
entities, backend functions, workflows, agents, realtime and file storage.

## Why it exists

Under the RIAA/IFPI GenAI labeling standard (effective July 2026), releases must
disclose AI involvement at track level, and DSPs already flag and block tracks
that don't. Independent creators are given the obligation but none of the
tooling. BASE Station closes that gap: every track leaves with a disclosure
label backed by evidence, a DDEX-exportable AI attribution bundle, a C2PA
provenance hash, an on-chain content-hash registration with a downloadable
certificate, and an inaudible forensic watermark embedded in the audio itself.

## Feature overview

| Area | What's in it |
| --- | --- |
| **Studios** | Music, Lyrics (+Pro), Cover Art, Stems (server or in-browser), Mashup, Vocal Harmonizer, Mastering, Cover Song, Audio Remix, Loops, SFX, Visualizer, Video, Promo, Voice Creator, Lead Sheet, Scribe, ID3 Tags, BASE Mark |
| **Audiotool Bridge** | Live Nexus peer client, Beat & Pattern / Harmony & Arrangement / Vocal Lab workspaces, Songstarter + 60s Pre-Starter, Session Explorer, MIDI Co-Producer, Contribution Meter — see [below](#audiotool-bridge--live-daw-peer) |
| **Creation tools** | SUB-Station multitrack workstation (split sheets, ownership hand-off), BASE Foundry DSP plugin studio, ORVO podcast studio |
| **Provenance** | BASE Mark watermarking (V1 spectral + V2 neural), BASE Print fingerprinting, Creative Ownership Score, hashed lead sheets, DDEX export, C2PA seal, on-chain registration, certificates |
| **Community** | Radio rack, charts, playlists, challenges, leaderboard, badges, featured artists, guest-accessible forum |
| **Live** *(beta)* | Streamr-transported realtime sessions, sub-second synchronized playback, portal stage visuals, chat + moderation, reactions, quests, recordable session bundles |
| **Video** *(beta)* | Self-hosted BASE Station LTX Engine for text-to-video (public LTX API fallback), image/audio-to-video, storyboarding, onset-timed cuts, scene templates & transitions, b-roll search, Shotstack composition & timeline editor |
| **Venues** | Portals 3D venues with idle playlists, schedules, staff and audience co-op |
| **Fan economy** | Fan clubs with tiers, collectibles, non-custodial tipping (Base, Solana, Audius, card), creator storefront, revenue dashboard |
| **Integrations** | Audiotool, Audius (publish/import/identity/contests), Kits.ai, Freesound, ElevenLabs, Replicate, IPFS/Pinata, Base & Solana, Streamr |
| **Workspace** | Library with lineage, projects, workspaces, generation history, credits, usage analytics |
| **Governance** | Public transparency registry of downstream DSP flags; community proposals & votes on the COS weights |

## The provenance stack

Three systems working together. **All of the sensitive logic runs server-side —
no watermark math, no scoring weights and no provider API key ever reaches the
browser.**

### 1. BASE Mark — multi-layer forensic audio watermarking

| Layer | Engine | Payload | Covers |
| --- | --- | --- | --- |
| **V1 — Spectral** | In-house DSP | 32-bit registry payload | Metadata stripping, transcodes, noise, quantization, most crops |
| **V2 — Neural** | SilentCipher-class model on private GPU | 32-bit payload + magic byte | Crop-robust recovery via phase-shift decoding |


Supporting machinery:

- **Desynchronization search + curated deep scan** recovers marks from re-timed
  audio by inverting exact-ratio sample-rate, semitone and speed transforms,
  batched to stay inside the CPU budget.
- **Duration-aware, evidence-scaled thresholds.** Gates scale with clip length
  in multiples of noise deviation. The detector **abstains** below the evidence
  bar and declines deep scans on clips under 12 seconds — a confident false
  attribution is worse than no answer.
- **Empirical benchmark harness.** A pure-DSP attack suite measures per-layer
  survival into a `BaseMarkBenchmark` entity, and the results are published
  in-app **including the failures**.
- **Public black-box verifier** at `/verify` — no account required, returns a
  detection outcome and a public registry match, never a threshold or a
  correlation strength.

- **BASE Print** — a re-timing-tolerant fingerprint that proposes alignments
  for spectral recovery. A Print match on its own is advisory and never counts
  as ownership.

> The earlier V3 Drift layer (WavMark) was retired after it measured 0%
> robustness to re-timing. Its archive lives in `src/docs/BASE_MARK_V3_ARCHIVE.md`.
> Pitch-preserved tempo stretch is still an open, stated limitation.

### 2. COS — Creative Ownership Score

A 0–100 score built from logged creative signals (own content, prompt
specificity, reference uploads, persona/style choices, iteration count),
producing an RIAA/IFPI-aligned `ai_generated` / `ai_assisted` / `human` label
**with a stated basis**. It derives a granular DDEX AI attribution profile
(lyrical / composition / instrumentation / vocals / post-production) and a C2PA
provenance hash. Derived assets inherit the most AI-intensive label in their
`parent_asset_id` chain, so a stem can't launder its origin. The weights
themselves are community-governed via `CosProposal` / `CosProposalVote`.

### 3. On-chain proof

Content hash registered to Base (Solana supported), provenance metadata pinned
to IPFS, a generated certificate PDF, and scheduled reconciliation audits.
Platform-sponsored — creators need no wallet and pay no gas.

## Audiotool Bridge — live DAW peer

BASE Station joins an Audiotool Nexus session as a real peer. It writes devices,
note regions, automation, patterns, samples and cables into the same live
document the Audiotool desktop has open. Three workspaces (Beat & Pattern,
Harmony & Arrangement, Vocal Lab) and a Songstarter hub feed that session.
Every AI action is logged privately in `NexusTelemetryEvent`, so the Creative
Ownership Score can split human work from machine work. Exports then run
through Protect & Register: watermark, COS, C2PA seal, Base anchor and Audius
release.

- Code map: [`src/docs/audiotool-hackathon/CODE_INDEX.md`](src/docs/audiotool-hackathon/CODE_INDEX.md)
- Submission README and stated limits: [`src/docs/audiotool-hackathon/README.md`](src/docs/audiotool-hackathon/README.md)
- Protobuf bridge service: [`src/docs/audiotool-bridge/`](src/docs/audiotool-bridge/)

## Live Studio — realtime performance *(beta)*

Live Studio is not a video call with music playing over it. It's a synchronized
performance layer built on the same infrastructure as the studios:

- **Sub-second playback alignment** across every viewer via a dedicated sync
  clock, so a drop lands at the same moment for everyone in the room
- **Streamr transport** for decentralized live audio delivery, fed by an
  AudioWorklet PCM capture path straight off the performer's chain
- **Portal stage visuals** — Butterchurn and Three.js scenes driven by live audio
  analysis, with fan-selectable visual layers
- **A real room** — chat with moderation, reaction bar, participant list,
  co-performer invites, live quests with XP, and triggered drop overlays
- **Sessions become assets.** A performance can be recorded, bundled and
  published to Audius, and it carries the same provenance treatment as a studio
  master — a live set leaves with its lineage intact rather than as an
  untraceable recording

## Video Studio — music video composition *(beta)*

**Text-to-video renders on our own LTX engine first** — a self-hosted Hugging
Face Space (`radiotomy/basestation-ltx-engine`) producing a fixed 768×512,
~4-second, 24 fps silent clip from a seeded prompt, copied into our storage and
pinned to IPFS before it is ever shown. If the engine is asleep, busy or fails,
the request falls through invisibly to the public LTX API (LTX-2.5 / 2.3, Fast &
Pro, up to 4K and 20 s, native audio). Image-to-video and audio-to-video use the
public API only for now. Details: `src/docs/ltx-engine/README.md`.

Around it: vibe-prompt storyboarding, cuts timed to the track's own transients
via onset detection, scene templates and transitions, Pexels b-roll preview, and
Shotstack composition plus a drag-and-drop timeline editor — with the source
track's provenance carried through to the finished video.

Both studios are gated behind beta access requests while we test them at scale.

## Roadmap

### Full DSP distribution

The gap we're closing next: getting a finished master from BASE Station onto
Spotify, Apple Music, YouTube Music, Amazon, Tidal and Deezer without the creator
leaving the platform — and without the provenance work being discarded at the
handoff, which is what happens today with every existing distributor.

That last part is the whole point, and it's why this is an opportunity rather
than a commodity integration. **A track leaving BASE Station arrives at a DSP
with exactly what the July 2026 RIAA/IFPI labeling standard asks for, already
assembled:**

- a track-level AI disclosure label with a stated evidentiary basis, not a
  self-declared checkbox
- a granular DDEX AI attribution profile (lyrical / composition /
  instrumentation / vocals / post-production)
- a C2PA provenance hash anchoring those metrics to the audio container
- an on-chain content-hash registration with a downloadable certificate
- a forensic watermark embedded in the audio itself, recoverable after transcode,
  crop, tempo change and close-range re-recording

DSPs and distributors are currently absorbing AI disclosure as a policy problem —
flagging, blocking, appealing and re-reviewing at scale, on metadata they have no
way to verify. Provenance-first ingestion inverts that: the disclosure arrives
verified, machine-readable and cryptographically anchored, so the platform
reviews evidence instead of manufacturing suspicion. Fewer false flags, fewer
appeals, and a defensible audit trail on both sides.

**Status:** actively evaluating distribution partners who want that pipeline as a
differentiator. If the right partner doesn't materialize, we'll build direct
delivery ourselves — the hard part, the provenance layer, is already shipped and
running in production.

Partner or DSP interest: reach out through the app's support channel.

Also in progress: tempo-stretch forensic coverage, 48 kHz watermarking, published cross-layer benchmark
results, and creator-facing appeal tooling backed by the transparency registry.

## Tech stack

- **Frontend:** React 18, Vite, Tailwind CSS, shadcn/ui, Framer Motion,
  React Router 6 (~200 lazy-loaded routes)
- **Audio/graphics:** Web Audio API, AudioWorklet, Butterchurn, Three.js,
  client-side WAV encoding and FLAC decoding
- **Backend:** Base44 — entities + RLS, Deno backend functions, workflows,
  in-app agents, realtime subscriptions, file storage
- **Self-hosted engines (Hugging Face Spaces):** BASE Station LTX Engine and
  Nova (MiniMax-H3) for video; Coda, Siren Song, Skye, Aurora (MiniMax-Music3),
  Inspire (InspireMusic) and Harmonix for music; Cadence (chord beds) and Cantor
  (DiffSinger vocals) for lead-sheet renders; Sever (stems, plus an in-browser
  ONNX version)
- **External:** Audiotool Nexus SDK, Kits.ai, LTX API (video fallback),
  Replicate, ElevenLabs, Audius, Freesound, Pinata/IPFS, Streamr, Shotstack,
  Pexels, Portals, Base/Solana RPC

## Repository layout

```
src/
  pages/            Route components (~90 pages, incl. admin/ and dev/)
  components/       Feature-scoped UI, grouped by domain
    ui/             shadcn/ui primitives — do not hand-edit
  hooks/            Audio, live-session and data hooks
  lib/              Auth context, query client, router helpers
  utils/            Audio DSP helpers, encoders, scoring utilities
  docs/             Engineering specs and protocol documentation
  config/           Static configuration (EQ zones, model specs, Streamr)
  api/              Pre-initialized Base44 SDK client
base44/
  entities/         Entity JSON schemas (+ RLS rules)
  functions/        Backend functions — one directory per function
  shared/           Server-side modules imported by functions
  agents/           In-app AI agent configs
  workflows/        Scheduled and event-triggered workflow definitions
public/             Service worker, PWA manifest, static assets
```

## Local development

**Prerequisites:** Node 18+ and npm.

```bash
git clone <your-repo-url>
cd base-station
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

Scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |

Changes pushed to this repository are reflected in the Base44 Builder, and
changes made in the Builder are pushed back here.

## Environment variables

Frontend only. Create `.env.local`:

```dotenv
VITE_BASE44_APP_ID=69f37db5a0cc60c31a7afc80
VITE_BASE44_APP_BASE_URL=https://base-station.base44.app
```

Never put a provider API key in a `VITE_`-prefixed variable — anything with that
prefix is compiled into the client bundle and is public.

## Backend secrets

Server-side secrets are configured in the Base44 dashboard, not in this
repository, and are readable only from backend functions via `Deno.env.get`.

| Group | Secrets |
| --- | --- |
| Watermarking | `BASE_MARK_SEED`, `BASE_MARK_PAYLOAD_KEY`, `BASE_MARK_V2_MODEL`, `BASE_MARK_V2_VERSION`, `BASE_MARK_V2_DEPLOYMENT`, `BASE_MARK_V4_MODEL`, `BASE_MARK_V4_VERSION`, `BASE_MARK_V4_KEY`, `BASE_PRINT_MODEL`, `BASE_PRINT_VERSION` |
| Audiotool / Kits | `AUDIOTOOL_CLIENT_ID`, `AUDIOTOOL_API`, `AUDIOTOOL_BRIDGE_URL`, `AUDIOTOOL_TEMPLATE_PROJECT`, `KITS_API_KEY` |
| Inference | `REPLICATE_API_TOKEN`, `REPLICATE_WEBHOOK_URL`, `REPLICATE_WEBHOOK_SECRET` |
| Chain / storage | `BASE_RPC_URL`, `PLATFORM_WALLET_PRIVATE_KEY`, `BASE_PLATFORM_WALLET_ADDRESS`, `SOLANA_PLATFORM_WALLET_ADDRESS`, `PINATA_JWT` |
| Providers | `ELEVENLABS_API`, `SONIC_API_KEY`, `TEMPCOLOR_API_KEY`, `LTX_API_KEY` (public LTX fallback — required even though text-to-video renders on our own engine first), `SHOTSTACK_API`, `AUDIUS_API_KEY`, `FREESOUND_API_KEY`, `PEXELS_API_KEY` |
| Self-hosted engines | `HF_TOKEN` (scoped to the Skye / Coda / Siren Song Spaces). The LTX, Cadence, Cantor and Sever Spaces are public-read and need no secret |

`BASE_MARK_SEED` and `PLATFORM_WALLET_PRIVATE_KEY` are the two that must never
be rotated casually or logged: the first invalidates every existing V1 watermark,
the second controls the sponsoring wallet.

## Deploying

Open the app in [Base44](https://app.base44.com) and click **Publish**. Backend
functions, workflows and entity schemas deploy from `base44/` automatically.

Model containers (BASE Mark V2/V4, BASE Print) and the self-hosted engine
Spaces are deployed separately. Each has its build files and instructions in
its own folder under `src/docs/`.

## Documentation

| Document | Contents |
| --- | --- |
| [`src/docs/ARCHITECTURE.md`](src/docs/ARCHITECTURE.md) | System design, request lifecycles, long-job pattern, security model |
| [`src/docs/DATA_MODEL.md`](src/docs/DATA_MODEL.md) | Entity map, asset lineage, RLS conventions |
| [`src/docs/BACKEND_FUNCTIONS.md`](src/docs/BACKEND_FUNCTIONS.md) | Function catalogue by domain, shared modules, auth rules |
| [`src/docs/CONTRIBUTING.md`](src/docs/CONTRIBUTING.md) | Conventions, review expectations, provenance-code rules |
| [`src/docs/BASE_MARK_FORENSIC_SPEC.md`](src/docs/BASE_MARK_FORENSIC_SPEC.md) | Watermark protocol, legal standing, measured limitations |
| [`src/docs/RIAA_AI_LABELING_POLICY.md`](src/docs/RIAA_AI_LABELING_POLICY.md) | Labeling standard and how the app implements it |

The app also ships user-facing API documentation at `/docs`.

## Security policy

Please **do not** open a public issue for a security problem — particularly
anything touching watermark recovery, the sponsoring wallet, or cross-user data
access. Contact the maintainers privately.

Standing rules enforced in this codebase:

- Watermark coefficients, detector thresholds and COS weights live in
  `base44/shared/` and are imported by functions. They never ship to the client.
- Every user-supplied URL passes through `assertSafeUrl`; proxies re-validate the
  host across redirects (SSRF).
- Any function that spends a platform token or wallet balance checks
  `user.role === 'admin'` server-side.
- Provider webhooks are HMAC-verified before their payload is trusted.

## Licence & attribution

Proprietary — all rights reserved. The BASE Mark embedding and detection
methods are maintained as trade secrets.

Third-party research this project builds on:

- WavMark — Chen et al., 2023 (retired V3 Drift Layer)
- [@audiotool/nexus](https://www.npmjs.com/package/@audiotool/nexus) (Audiotool Bridge)
- *SoK: How Robust is Audio Watermarking in Generative AI Models?* —
  arXiv:2503.19176 (robustness benchmarking methodology)

Built with [Base44](https://base44.com).