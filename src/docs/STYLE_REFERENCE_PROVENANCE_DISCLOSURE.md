# Provenance Disclosure — Style Reference & Master-Derived Generation

**Applies to:** Pro Songwriter (`generateLyricsPro`), 243 Masters (`generate243Masters`), Writer Style Lookup (`lookupWriterStyle`)
**Version:** 1.0 · July 2026
**Status:** Platform disclosure template — attach or reference when distributing works created with these tools.

---

## 1. What These Tools Do

When a user enters an artist or writer name as a "reference," BASE Station does **not**
reproduce that artist's recordings, lyrics, voice, or any copyrighted expression. Instead,
the platform performs a **style abstraction**:

1. The name is resolved to a set of **non-copyrightable structural descriptors** —
   rhyme scheme (e.g., ABAB), typical BPM range, prosody, narrative tone, vocabulary
   register, and genre conventions.
2. Only those abstract descriptors are passed to the generative model. The artist's
   name is **not** used to claim authorship, endorsement, or affiliation.
3. All lyrical output is **original text** generated against the user's own topic,
   mood, and structural selections.

## 2. Legal Basis

- **Style is not copyrightable.** Copyright protects specific expression (lyrics,
  recordings, melodies), not genres, rhyme schemes, chord conventions, tempos, or
  narrative styles. Extracting and applying structural archetypes is analogous to a
  songwriting student studying a writer's craft.
- **No right-of-publicity use.** Reference names are used internally as lookup keys
  only. They are never embedded in output lyrics, track metadata, titles, credits,
  or marketing material, and no simulation of an artist's actual voice is performed
  by these tools.
- **No training-data claims.** These features do not fine-tune models on any specific
  artist's catalog; they map names to editorially curated craft profiles.

## 3. What Is Disclosed in the Provenance Record

Each generation is logged with Human-in-the-Loop (HITL) telemetry:

| Field | Content |
|---|---|
| `participation_signals` | User's structural choices (topic, rhyme scheme, moods, styles, BPM) |
| `human_participation_score` | 0–100 Creative Ownership Score |
| `ai_disclosure_label` | `ai_assisted` / `ai_generated` per the voluntary GenAI labeling program (RIAA, IFPI & partners, July 2026) |
| `ddex_ai_metadata` | Granular flags (lyrical content, composition, vocals, post-production) |
| `c2pa_provenance_hash` | Cryptographic anchor of the above to the asset |

Style-reference influence is recorded as a **user-directed structural input** — a human
creative decision — not as reproduction of third-party content.

## 4. User Responsibilities

By using these tools, the user agrees to:

- **Not** market or title output as being "by," "featuring," or "in the voice of" any
  real artist.
- **Not** use reference names in released metadata, credits, or artwork.
- **Not** attempt to replicate specific copyrighted lyrics, melodies, or recordings.
- Accurately carry the assigned AI disclosure label through distribution.

Misrepresentation may result in removal of content and account action per the
platform Terms of Use.

## 5. Purpose Statement

These features exist to give independent creators access to professional songwriting
craft — structure, prosody, and arrangement knowledge — while keeping the creative
direction, subject matter, and final editorial control in human hands, and keeping a
verifiable, exportable record of that human participation.