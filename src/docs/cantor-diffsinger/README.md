# Cantor — BASE Station's DiffSinger singing-voice engine

Self-hosted Hugging Face Space that renders a **human-authored melody** (syllables +
pitches + durations) into sung vocals using DiffSinger ONNX voicebanks.

Space: `radiotomy/cantor` → `https://radiotomy-cantor.hf.space`

## Why this engine exists

Every other vocal path on the platform infers a melody from a prompt. Cantor sings
the notes the creator actually wrote. That is what makes a `LeadSheet` a real
provenance artifact instead of a description of one: the vocal line is authored, so
the Creative Ownership Score for it is human **by construction** rather than by
inference.

Consequence for anyone maintaining this Space: **the engine must not re-pitch or
"improve" the melody.** An output that drifts off the authored notes silently
invalidates the authorship claim the whole feature rests on.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/health` | Boot check + which voicebanks loaded |
| `GET`  | `/voicebanks` | Installed banks, with `renderable` flag and licence text |
| `POST` | `/render` | `{ voicebank, bpm, notes: [{syllable, midi, beats}] }` → `{ job_id }` |
| `GET`  | `/status/{job_id}` | `queued` / `processing` / `completed` / `failed` |

`/render` returns immediately. A CPU diffusion render takes minutes, so the backend
polls — and the Space runs **one job at a time** on purpose (concurrent renders each
hold a full model in RAM, which is precisely how the Coda and Siren Song Spaces earn
their meta-tensor/OOM crashes).

## Installing voicebanks

Cantor ships with **no voicebanks**. It is an engine; a bank is the voice. Drop each
bank into persistent storage:

```
/data/voicebanks/<bank_id>/
    dsconfig.yaml        # DiffSinger bank config (phonemes, models, sample rate)
    acoustic.onnx        # mel generation
    vocoder.onnx         # mel -> waveform   (may be shared/global instead)
    dictionary.txt       # grapheme -> phoneme, tab separated
    LICENSE              # <- read this before shipping the bank to users
```

`/voicebanks` reports `renderable: false` for any bank missing a required model
rather than hiding it, so a half-installed bank shows up as a diagnosable problem
instead of vanishing.

### Licensing — read before adding a bank

Community DiffSinger banks are a **licence patchwork**. Some are explicitly free for
commercial use, some are non-commercial, some require the author's permission, and
some were trained on a real singer's voice without their consent — which is a
right-of-publicity problem *separate from* whatever licence file is in the folder.

Keep the `LICENSE` file with every installed bank and surface its terms through
`/voicebanks`, so the studio can show a creator what they are actually allowed to do
with the render. The long-term plan is BASE Station's own banks trained from
licensed, consented vocal sessions — a voice the singer agreed to.

## First deployment: smoke test before trusting it

The ONNX tensor names below follow the OpenUTAU DiffSinger ONNX convention, but banks
vary in which models and expressions they export. **Run one short render immediately
after installing a bank** and confirm the output follows the requested pitches. If the
acoustic model rejects the input names, `/status` will report the exception verbatim —
that message names the tensor the bank actually expects.