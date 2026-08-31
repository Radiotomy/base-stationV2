# Cadence — chord-conditioned instrumental bed engine

Self-hosted replacement for `sakemin/musicgen-chord` on Replicate. Renders an
instrumental bed that plays a **human-authored chord progression** from a
BASE Station LeadSheet.

- **Space:** `radiotomy/cadence`
- **Hardware:** T4 small minimum (1.5B model, fp16). A10G small for faster renders.
- **Secret:** none. Uses Meta's public `facebook/musicgen-melody` checkpoint.
- **Client:** `base44/shared/cadenceEngine.ts`
- **Backend:** `generateBedMusicGenChord` → `pollMusicGenChordBed`

---

## The finding that shaped this build

MusicGen-Chord (Jung et al., [arXiv:2412.00325](https://arxiv.org/abs/2412.00325))
**is not a fine-tuned model.** It is a conditioning trick applied to stock
MusicGen-Melody weights:

| | Chroma conditioning |
|---|---|
| MusicGen-Melody | **one**-hot — one pitch class per frame (a melody) |
| MusicGen-Chord | **multi**-hot — several pitch classes per frame (a chord) |

The paper states the trick works *"using the pretrained MusicGen model weights,
without requiring any fine-tuning."*

So there was never a checkpoint to port. The entire model-specific work is
`build_chord_chroma()` in `app.py` — about 60 lines of readable Python that we
own outright. This is why self-hosting cost a day rather than a training run,
and why our chord vocabulary, bar subdivision and voicing are tunable while
Replicate's were frozen behind a version hash.

---

## Architecture

```
LeadSheet.chord_chart ("C | Am | F | G7", verbatim as authored)
    ↓  normalizeChordChart()          base44/shared/chordNotation.ts
"C A:min F G:7"                       Harte ROOT:TYPE notation
    ↓  POST /generate
build_chord_chroma() → [T, 12] multi-hot matrix
    ↓  ChordInjector replaces the melody conditioner's output
MusicGen-Melody 1.5B  (+ prose prompt for instrumentation)
    ↓
32 kHz WAV → Base44 storage → UserAsset (ai_assisted, COS 70)
```

### The one load-bearing trick: self-calibrating frame count

The conditioner wants chroma at its own internal frame rate, derived from
audiocraft's chroma hop size. **Hardcoding that rate is how this integration
rots:** a wrong frame count does not raise — it silently smears the harmony
across bars, which looks like "the model ignored my chords."

So `ChordInjector` never guesses. It calls audiocraft's original implementation
on the incoming reference wav, reads the exact `[B, T, 12]` shape audiocraft
asked for, and builds our matrix at precisely that `T`. Version-proof by
construction; survives an audiocraft bump that changes the hop size.

### Why a silent reference wav is passed

`generate_with_chroma()` requires a melody wav. Ours is pure silence — it
exists only so audiocraft runs its chroma path and reveals `T`. The injector
discards its content. That is why generating from a typed chart uploads no
audio at all.

---

## Chord notation

Harte-style `ROOT:TYPE`, space-separated. **One chord per bar.** A comma
subdivides a bar equally.

```
C G:7 A:min,D:7 F:maj7
└bar┘└bar┘└──bar──┘└bar┘
```

Bar length comes from the score's own BPM and time signature. The progression
**loops** until the requested duration is filled, so a 4-bar chart carries a
60-second bed without restating it.

Supported types: `maj min dim aug sus2 sus4 5 7 maj7 min7 minmaj7 dim7 hdim7
maj6 min6 9 maj9 min9 11 min11 13 maj13`. Slash bass (`C/E`) parses; the bass
note is dropped, since chroma has no register.

Extensions are **kept**, not reduced to triads — a writer who typed `maj7`
wants the 7th to sound, and quietly simplifying their harmony is the one thing
a score-adherent engine must not do. An *unrecognised* extension degrades to
the parent triad rather than to silence: a wrong-but-harmonic bar beats a hole
in the progression.

---

## API

```
GET  /health           → { status, model, loaded, cuda, in_flight }
POST /generate         → { job_id, status: "processing" }
GET  /status/{job_id}  → { status: processing|completed|failed, audio?, error? }
GET  /outputs/{id}.wav
```

`POST /generate` body:

```json
{
  "prompt": "warm fingerpicked acoustic guitar, soft upright bass",
  "text_chords": "C A:min F G:7",
  "bpm": 96,
  "time_sig": "4/4",
  "duration": 30,
  "temperature": 1.0,
  "cfg_coef": 3.0,
  "top_k": 250
}
```

**`prompt` must describe instrumentation only.** Chord names in the prose make
the model fight its own conditioning — the harmony is already fully specified
by `text_chords`.

---

## Deployment

1. Create Space `radiotomy/cadence`, SDK **Docker**, hardware **T4 small**.
2. Upload `app.py`, `Dockerfile`, `requirements.txt`.
3. First build is slow (~15 min: CUDA base + audiocraft). First *generation*
   also downloads the 1.5B checkpoint (~3.5 GB) — expect a 2-3 minute cold start,
   then warm renders.
4. Verify: `curl https://radiotomy-cadence.hf.space/health`

No secret to configure. The Space is public-read; our backend calls it with
`HF_TOKEN` only if the Space is set private.

---

## Deliberate constraints

**Serial execution.** One worker, queued jobs. Concurrent requests against a
single CUDA-resident model produce `Cannot copy out of meta tensor` — the
failure that bit Coda and Siren Song. A queue costs waiting; concurrency costs
the creator their generation.

**120-second ceiling.** MusicGen's native window is 30 s; beyond that audiocraft
extends by sliding-window continuation, and harmonic coherence with the *stated*
progression degrades as the context slides. 120 s is where it stops being worth
charging for.

**Instrumental only.** MusicGen produces no vocals. The sung line comes from
Cantor and the two are combined in SUB-Station — which is also what keeps their
provenance separable: an authored melody and an AI arrangement of authored
chords are different authorship claims and must not collapse into one asset.

---

## Tuning notes for the move to our own GPU

Everything worth tuning is in this file, which is the point.

- **`cfg_coef`** (default 3.0) — raise toward 4-5 to push the prose prompt
  harder; lower toward 2 to let the chord conditioning dominate.
- **`temperature`** (default 1.0) — lower for more predictable, on-grid playing.
- **Voicing** — `CHORD_TYPES` sets pitch classes only. Chroma carries no
  register, so inversions and voice-leading are outside this representation.
  Adding them means moving past the chroma conditioner entirely.
- **Upgrade path: MusiConGen** (2024) fine-tunes MusicGen-melody for *joint*
  chord **and rhythm** control and reports tighter adherence than the chroma
  trick. It needs a real checkpoint and real training — worth doing once this
  Space has told us what our creators actually ask for. Which is the reason to
  run a Space now rather than rent an endpoint.

---

## Licensing

- **AudioCraft code** — MIT.
- **`facebook/musicgen-melody` weights** — CC-BY-NC 4.0, **non-commercial**.

That second line is a genuine constraint, not boilerplate: if beds are sold or
bundled into paid output, the checkpoint has to change. `facebook/musicgen-*`
are all CC-BY-NC. Commercially clear routes, in order of effort: train the
chroma-conditioned model on licensed audio (the trick needs no fine-tuning, but
a *clean* base model still needs pretraining), or condition our
Apache-2.0 Coda engine (ACE-Step 1.5) on the chart instead and accept looser
adherence. Raise this before beds leave testing.