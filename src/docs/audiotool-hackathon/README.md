# BASE Station × Audiotool — "Let's Build" Submission

**A provenance-first AI music studio that works as a live peer inside Audiotool Nexus sessions — across all six Let's Build categories.**

[Submission kit](https://base-station.base44.app/hackathon) · [Interactive deck](https://base-station.base44.app/hackathon/deck) · [Audiotool Bridge](https://base-station.base44.app/audiotool) · [Watermark verifier](https://base-station.base44.app/verify)

BASE Station opens the same live Nexus document your Audiotool desktop has open and writes to it in real time — devices, note regions, automation, patterns — while a parallel provenance pipeline scores who did the creative work (human vs AI) and forensically watermarks the exported master.

---

## The six categories

| # | Category | What we ship | Where |
|---|---|---|---|
| 01 | **Discovery & Ideation — Songstarter** | Vibe → Session starters, Instrument Chain builder, BASE Forge loops, ElevenLabs SFX, semantic sound search, Freesound, Audius remix + contests | `/audiotool` (Songstarter) |
| 02 | **Theory & AI Composition** | Chord Progression writer + pads, LeadSheet import, MIDI Co-Producer with undo, Cantor vocals from composed melodies, Cadence chord-conditioned beds | `/studios/audiotool/harmony`, `/lead-sheet-studio`, `/scribe-studio` |
| 03 | **Synthesis & Texture — Sound Design** | BASE Foundry DSP studio, Foundry Remote knob control of live Audiotool devices, cable mirroring, Beatbox 8 / Bassline / Tonematrix generators | `/foundry`, `/studios/audiotool/beat` |
| 04 | **Play & Live — Music Games** | Audience Co-Op chat generation, Streamr live sessions, Portals 3D venues, quests, XP, reactions, drops | `/live-studio`, `/venues` |
| 05 | **DAW Integration — Connect** | Native Nexus peer client, Session Explorer, deep links, protobuf Nexus Bridge, Audius import/export, ID3/DDEX, Base anchor | `/audiotool`, `/verify` |
| 06 | **Growth — Marketing & Distribution** | Protect & Register export, Promo Studio, social automation, fan clubs, collectibles, tipping, creator store, charts | `/promo-studio`, `/social-automation`, `/charts` |

## How it works

1. Sign into Audiotool from the Bridge hub (`/audiotool`).
2. Open a project, paste a project link, or start a Vibe → Session starter.
3. Open a workspace: **Beat & Pattern**, **Harmony & Arrangement**, or **Vocal Lab**.
4. Generate or find a sound and hit **Send to Audiotool** — it lands on the live timeline.
5. **Protect & Register** the export: BASE Mark watermark, Creative Ownership Score, C2PA manifest, on-chain Base anchor, Audius distribution.

## Technical highlights

- **Peer client, not a wrapper** — same `DocumentService` stream as the Audiotool desktop; changes are live in both directions.
- **Native protobuf ingestion** — `dts_to_proto.py` rebuilds Audiotool's document `.proto` files from the pinned `@audiotool/nexus` package.
- **AI-origin telemetry** — every AI invocation is logged privately in `NexusTelemetryEvent`; undone AI work is deleted so it never counts against the creator.
- **BASE Mark** forensic watermark with a published benchmark, failures included.
- **Creative Ownership Score** with RIAA/IFPI-aligned labels, DDEX attribution and C2PA manifest.
- **Server-side secrets** — watermark math, scoring weights and API keys never reach the browser.

## Why this wins

It is **live** (a real Nexus peer), **honest** (watermark, ownership score, label, on-chain anchor, published methodology), **broad** (all six tracks), and **shipped** (installable PWA, self-hosted engines, working public verifier).

Built with [Base44](https://base44.com) and the open-source [@audiotool/nexus](https://www.npmjs.com/package/@audiotool/nexus) SDK.