# BASE Station × Audiotool — "Let's Build" Submission

**A provenance-first AI music studio that works as a live peer inside Audiotool Nexus sessions — across all six Let's Build categories.**

**▶ Try it live: [basestation.live/audiotool](https://basestation.live/audiotool)** — launches the Audiotool Bridge.

[Submission kit](https://basestation.live/hackathon) · [Interactive deck](https://basestation.live/hackathon/deck) · [60s Pre-Starter](https://basestation.live/pre-starter) · [Watermark verifier](https://basestation.live/verify)

BASE Station opens the same live Nexus document your Audiotool desktop has open and writes to it in real time — devices, note regions, automation, patterns, samples and cables — through three dedicated workspaces and a Songstarter hub. Every AI action is logged privately so a Creative Ownership Score can split human from machine work, and the exported master is watermarked, sealed with a C2PA manifest, anchored on Base and distributable to Audius.

---

## The six categories

| # | Category | What we ship | Where |
|---|---|---|---|
| 01 | **Discovery & Ideation — Songstarter** | 60s Pre-Starter (Cadence chord bed + Forge drums + riser, previewed locally, sent as a mix or stems), Vibe → Session, Instrument Chain builder, Forge loops, ElevenLabs SFX, semantic sound search, Freesound, Audius remix + contests with linked entries | `/audiotool`, `/pre-starter` |
| 02 | **Theory & AI Composition** | Harmony & Arrangement workspace (chord writer, chord pads, arrangement view), Cadence chord-conditioned beds from typed progressions, MIDI Co-Producer with history + undo, hashed Lead Sheet import, Cantor vocals from composed melodies, Scribe transcription | `/studios/audiotool/harmony`, `/lead-sheet-studio`, `/scribe-studio` |
| 03 | **Synthesis & Texture — Sound Design** | Beat & Pattern workspace (Beatbox 8 / Bassline / Tonematrix), Automation Lane generator, BASE Foundry DSP + device map, Foundry Remote knob control with cable mirroring, Vocal Lab (take recorder, Kits.ai conversion, AI harmony layers) | `/studios/audiotool/beat`, `/foundry`, `/studios/audiotool/vocal` |
| 04 | **Play & Live — Music Games** | Audience Co-Op chat generation into the live session, Streamr live sessions, Portals 3D venues, quests, XP, reactions, drops | `/live-studio`, `/venues` |
| 05 | **DAW Integration — Connect** | Native Nexus peer client, Session Explorer (family colours, AI-origin markers, deep links), collaborators + roles, SUB-Station multitrack hand-off, protobuf Nexus Bridge, ID3/DDEX, Audius import/export | `/audiotool`, `/sub-station`, `/verify` |
| 06 | **Growth — Marketing & Distribution** | Protect & Register export pipeline, Audius ↔ chain bridge, Promo Studio, social automation, fan clubs, collectibles, non-custodial tipping, creator store, charts | `/promo-studio`, `/social-automation`, `/charts` |

## How it works

1. Sign into Audiotool from the Bridge hub (`/audiotool`) — Audiotool opens in a pop-out window beside BASE Station.
2. Open a project, paste a link, or start from Vibe → Session or the 60s Pre-Starter.
3. Work in **Beat & Pattern**, **Harmony & Arrangement** or **Vocal Lab** — all write live to the same session.
4. Audition locally, then **Send to Audiotool** — it lands on the live timeline, on the grid.
5. **Protect & Register** the export: BASE Mark watermark, Creative Ownership Score, C2PA seal, Base anchor, Audius release.

## Technical highlights

- **Peer client, not a wrapper** — same document stream as the Audiotool desktop; changes are live in both directions.
- **Native protobuf ingestion** — `dts_to_proto.py` rebuilds Audiotool's document `.proto` files from the pinned `@audiotool/nexus` package.
- **AI-origin telemetry** — every AI invocation (co-producer, chains, loops, SFX, patterns, automation, Cadence beds, Cantor vocals, harmonies) is logged privately in `NexusTelemetryEvent`; undone AI work is deleted so it never counts against the creator.
- **Live Nexus Contribution Meter** — human vs AI split visible while you work.
- **BASE Mark** forensic watermark cascade with a published benchmark, failures included.
- **Creative Ownership Score** with RIAA/IFPI-aligned labels, DDEX attribution and C2PA manifest.
- **Server-side secrets** — watermark math, scoring weights and API keys never reach the browser.

## Beyond Audiotool

What BASE Station adds that Audiotool doesn't offer on its own:

- Mobile & tablet session access — Audiotool's own pages don't load on phones, but every BASE Station tool does. Sign into the Audiotool Bridge from BASE Station and keep working on your project from a phone or tablet: patterns, chords, loops, vocals and samples still push live into the session. Only Audiotool's in-browser interface is unavailable on mobile.

- Authorship provenance — a hashed lead sheet proves melody and chords were human-written before any AI render.
- Forensic watermarking and a public verifier that traces a file to its registered source.
- On-chain Base anchoring of the delivered, watermarked file.
- Self-hosted engines: Cadence (chord beds), Cantor (singing), Sever (stems), plus in-browser stem separation.
- Kits.ai voice conversion and harmonies on a shared, rate-limited queue.
- Direct Audius publishing, remix-contest entries and chart placement.
- SUB-Station multitrack editor with split sheets and ownership hand-off.

## Honest limits

- Cadence beds currently use non-commercial (CC-BY-NC 4.0) model weights — drafting, testing and personal use only. We're working on licensing, or on training our own weights as the engine's open license allows. A commercial-ready alternative is already in place: BASE Forge, running our own altered/tuned version of Stable Audio 2.5, alongside other engines.
- Audiotool can't be embedded in an iframe, so it runs in a managed pop-out window.
- The Audiotool SDK/API doesn't allow importing or exporting a project's cover artwork, templates, or community tracks — users import those manually, and push manually for distribution outside Audiotool.
- VST Bridge plugin hosting isn't exposed through Audiotool's API, so we don't control it.

## Why this wins

It is **live** (a real Nexus peer), **honest** (watermark, ownership score, label, on-chain anchor, published methodology, stated limits), **broad** (all six tracks), and **shipped** (installable PWA, self-hosted engines, working public verifier).

Built with [Base44](https://base44.com) and the open-source [@audiotool/nexus](https://www.npmjs.com/package/@audiotool/nexus) SDK.