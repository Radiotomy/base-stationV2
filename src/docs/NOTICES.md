# Third-Party Notices & Licence Obligations

BASE Station is **proprietary software, all rights reserved**. It uses the
third-party components below under their own licences. Using them does not
relicense BASE Station code, and nothing here grants any right to BASE Station's
own code, models or trade secrets.

_Last reviewed: 2026-09-28_

## 1. BASE Station proprietary and trade-secret material

| Component | Location | Status |
|---|---|---|
| BASE Mark watermarking (V1 spectral, V2 finalize/gating, V4 message/gate, search, resolve, verify) | `base44/shared/baseMark*.ts` | **Trade secret**. Server-side only. |
| BASE Print fingerprinting and seeded recovery | `base44/shared/basePrint*.ts`, `printRegistry.ts`, `printSeededRecovery.ts` | **Trade secret**. Server-side only. |
| Creative Ownership Score engine and stamping | `base44/shared/cosEngine.ts`, `cosStamp.ts` | **Trade secret**. The weights are private; the public rubric is community-governed. |
| Harmonix forensic generation path | `base44/shared/harmonixForensics.ts` | **Trade secret**. |
| BASE Forge tuned weights, Skye fork, engine wrappers | self-hosted Spaces, `src/docs/<engine>/` | Proprietary modifications, subject to upstream terms below. |

Trade-secret files carry a `TRADE SECRET` header. They are never bundled into
the client, and every key and seed lives in server secrets. Public trust comes
from the C2PA manifest, the on-chain anchor and the published benchmark, not
from disclosing the method.

## 2. Open-weight models

| Engine | Upstream | Licence | Obligation | How it's met |
|---|---|---|---|---|
| Aurora | MiniMaxAI/MiniMax-Music3 | MiniMax-Music3 Community License | Show "MiniMax-Music3" prominently in the UI. Needs written authorisation above US$20M yearly revenue. Follow the AUP and safeguards. | UI attribution shipped (`MiniMaxAttribution`). Attribution recorded on each job row. |
| Nova | MiniMaxAI/MiniMax-H3 | MiniMax-H3 Community License | Show "MiniMax-H3" prominently in the UI. Revenue threshold applies. Check the territorial terms before commercial use in restricted regions. | UI attribution shipped (`MiniMaxH3Attribution`). |
| Inspire | FunAudioLLM InspireMusic | Apache-2.0 | Keep the licence and NOTICE. State any changes. | Credited here and in `src/docs/inspire-inspiremusic/`. |
| Skye | DiffRhythm 2 (fork) | Apache-2.0 | Keep the licence and NOTICE. State any changes. | `src/docs/skye-diffrhythm2/` |
| Siren Song | HeartMuLa | Apache-2.0 | Keep the licence and NOTICE. State any changes. | `src/docs/siren-song-heartmula/` |
| Sever / on-device stems | HTDemucs (Demucs) | MIT | Keep the copyright notice. | `src/docs/sever-htdemucs/` |
| Cantor | DiffSinger + community voicebanks | Apache-2.0 engine. Each bank has its own licence. | Show each bank's licence before rendering. | `Voicebank.license_text` is shown before every render. |
| BASE Forge | Stable Audio 2.5 (tuned) | MIT | Keep the copyright and licence notice. | Credited here. |
| **Cadence** | MusicGen-Chord / MusicGen weights | **CC-BY-NC 4.0 (non-commercial)** | No commercial use of outputs. | **Internal testing and evaluation only. Not shipped to users.** Will be replaced by BASE Forge or our own weights. No Cadence output may be released commercially. |
| **ChordSeqAI** | Conditional Transformer S next-chord model + chord vocabulary (github.com/PetrIvan/chord-seq-ai-app, commit cae8240) | **MIT** — Copyright (c) 2023 Student Trainee Center | Keep copyright + permission notice. | Runs in the creator's browser for "Suggest next chord" in the Audiotool Harmony workspace. Loaded unmodified from the pinned upstream commit; notice kept here and in the UI. |

## 3. SDKs and libraries

| Package | Licence | Notes |
|---|---|---|
| @audiotool/nexus | Apache-2.0 | Powers the Audiotool Bridge. Use of the Audiotool API is also governed by Audiotool's API terms and User Data Policy. |
| @audius/sdk | Apache-2.0 | Audius publishing, import and identity. |
| @streamr/sdk | Apache-2.0 | Live-session transport. |
| onnxruntime-web | MIT | In-browser stem separation. |
| React, Vite, Tailwind, Radix/shadcn, three.js, butterchurn, recharts, framer-motion and others | MIT / ISC / Apache-2.0 | Standard permissive licences. See `package.json` and each package's licence. |

## 4. Research lineage (no code redistributed)

- WavMark (Chen et al., 2023) for the retired V3 Drift Layer.
- SilentCipher-class neural watermarking for V2.
- audiowmark for the V4 Speed Layer.
- *SoK: How Robust is Audio Watermarking in Generative AI Models?*
  (arXiv:2503.19176) for the benchmark methodology.

## 5. Hosted services (commercial API terms)

These services are governed by their own terms of service, not open-source
licences: ElevenLabs, Kits.ai, Replicate, LTX, Shotstack, Pexels, Freesound
(each sound keeps its own CC licence), Pinata, AssemblyAI, Inworld, Portals,
Stripe, Base and Solana RPC.