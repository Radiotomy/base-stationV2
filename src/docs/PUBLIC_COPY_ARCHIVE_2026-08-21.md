# Public-Facing Copy Archive — 2026-08-21

Verbatim snapshot of the public trust/provenance claims **before** the "evidence, not
ownership" honesty pass. Kept so any claim can be restored or compared, and so the
history of what BASE Station asserted publicly on a given date is recoverable.

Reason for the change: competitive review of Suede Labs AI (`ip.suedeai.ai`), whose
public posture leads with the limits of provenance ("a fingerprint identifies bytes",
"a claim is still a claim", "evidence, not ownership"). Two conclusions drove the
rewrite:

1. Several BASE Station claims read stronger than what the technology establishes —
   specifically "proof of creation", "proof of ownership", and "see who it belongs to".
   Overclaiming provenance is the fastest way to lose credibility with rights holders,
   distributors and regulators.
2. Hash-only registries publish their own fatal limitation: change the file and the
   fingerprint breaks. BASE Mark survives transcode, re-encode and re-timing because
   the payload lives in the waveform, not the container. That contrast was buried in an
   internal forensic spec and is now stated on the public pages.

---

## src/pages/TrustCenter.jsx

### Header
> **Built In. Not Bolted On.**
> # Trust & Provenance
> BASE Station watermarks, scores, labels and registers every track the moment it is
> saved — automatically, with nothing to opt into. This is the single place to
> understand what that means and where each record lives.

### Pillar — Disclosure / GenAI Label
> Every sound recording is labeled AI-Generated, AI-Assisted or Human, in line with the
> music community's voluntary track-level labeling program (July 2026).

### Pillar — Attribution / Creative Ownership Score
> A 0–100 measure of the human creative input behind a work, graded across five
> creative dimensions and exportable as a DDEX attribution profile.

### Pillar — Forensics / BASE Mark
> Two independent inaudible signatures woven into the waveform itself, applied
> automatically to every master on save. Measured to survive stripped metadata,
> re-encoding, compression, cutting and stem-splitting — and to trace any derivative
> back to its origin. Re-timed copies are handled by dedicated stages still in
> measurement; every limit we have measured is published in full.

### Pillar — Proof / On-Chain Registration
> A content hash of the marked audio is written to the registry with an immutable
> timestamp — proof of creation that outlives any single platform.

*(Pillar label was "Proof"; link label "Your registry records".)*

### Human-first stance
> ## AI is the instrument. You are the artist.
> We build some of the strongest AI music tools available, and left on autopilot they
> could run as a fully automated hit factory. That is not what this platform is for.
> Work that leans on the tools with little human direction is scored and labeled
> exactly as such; work shaped by your words, your references and your refinements
> earns the score and the label that reflect it. Human participation is not just
> encouraged here — it is measured, credited and rewarded.

### Where your records live
- **Ownership dashboard** — Your score history, tier breakdown and every asset's Provenance Manifest.
- **Proof of ownership** — On-chain registrations and downloadable certificates for your catalog.
- **Public verification** — Anyone can scan an audio file for a BASE Mark and see who it belongs to.

---

## src/pages/CreativeOwnership.jsx

### Hero
> **The Living Standard — tuned by the community**
> # Your Creativity, Measured & Credited
> The Creative Ownership Score (COS) is a 0–100 measure of the human creative input
> behind every piece of AI-generated content on BASE Station — aligned with the music
> community's voluntary GenAI labeling program (RIAA, IFPI & partners, July 2026). It's
> not a static ceiling: the scoring weights are an open, adaptive ledger that the
> community benchmarks and tunes together.

### Why it matters
> ## AI is the instrument. You are the artist.
> Anyone can press a button. What sets creators apart is the direction they give — the
> lyrics they write, the references they bring, the styles they choose, and the
> refinements they make. The COS captures that fingerprint and turns it into a score, a
> disclosure label, and a creator tier that travel with your work.

### Provenance Manifest section
> Your score doesn't stay locked inside BASE Station. Every scored asset carries a
> DDEX-style AI attribution profile — granular flags for lyrical content, composition,
> instrumentation, vocals, and post-production — plus an optional C2PA provenance hash
> anchoring the COS metrics to the audio container.

- **Granular attribution** — Each creative layer is marked 🤖 Synthetic or 👤 Human based on your recorded telemetry — no guesswork.
- **DDEX Tag Bundle export** — Copy an XML metadata snippet from any manifest to hand to distributors and downstream partner channels.
- **Clear verification blocks** — Use a high-COS manifest as an authoritative credential when platforms flag AI content for manual review.

---

## src/pages/AITransparency.jsx

### Header
> **Music Community GenAI Labeling Program · July 2026**
> # AI Transparency
> BASE Station voluntarily labels every sound recording in alignment with the
> track-level GenAI labeling program introduced by the music community (IFPI, RIAA,
> A2IM, WIN, IMPALA, The Grammys, SAG-AFTRA & the Human Artistry Campaign — July 2026).

### Who determines the label
> **Uploaded tracks:** the artist self-declares the label at submission, attesting to
> how generative AI was used in the recording. Like the program itself, this is a
> voluntary, honesty-based disclosure — there is no automated "percentage of AI"
> measurement.
>
> **Tracks created in BASE Station studios:** the label is stamped automatically by our
> pipeline. Fully prompt-generated music and AI vocals are labeled AI-Generated; AI
> harmonies and AI mastering of a human recording are labeled AI-Assisted.
>
> **Derived works** (stems, masters, mashups) inherit the most AI-intensive label in
> their provenance chain: AI-Generated > AI-Assisted > Human.

---

## src/pages/VerifyMark.jsx

> # Verify a BASE Mark
> Free, no account needed. Drop in any audio file — WAV, MP3, OGG, M4A, WebM, or FLAC —
> and we scan its waveform for a BASE Mark, the inaudible provenance signature embedded
> in tracks made on BASE Station.
>
> Only a short audio snippet is analyzed on our secure servers. The acoustic scan runs
> in memory; signed-in creators also get a neural scan (snippet uploaded for that run
> only).
>
> Want your own tracks protected? Every audio master (WAV or FLAC) saved on BASE Station
> is marked automatically, and the payload is threaded through its Provenance Manifest,
> DDEX bundle, and on-chain record.
>
> BASE Mark is one signature made of two layers, applied automatically to every saved
> track: a spectral layer and a neural layer. This public scan checks the spectral layer
> first; signed-in creators also get a neural scan; a clean scan is not proof a file was
> never marked.

---

## src/components/home/HomeTrustStrip.jsx

> **Protected the moment you hit save.**
> Every track is watermarked, scored, labeled and registered automatically — no setup,
> nothing to opt into. AI is the instrument; you stay the artist, and the record proves
> it.
>
> Chips: GenAI label · Ownership score · BASE Mark · On-chain proof
> CTA: Trust & Provenance