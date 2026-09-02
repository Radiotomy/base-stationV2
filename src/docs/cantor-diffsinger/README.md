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

| `POST` | `/install` | **Owner only.** `{ bank_id, zip_url, kind: 'voicebank'\|'vocoder', replace }` → `{ job_id }` |
| `DELETE` | `/voicebanks/{bank_id}` | **Owner only.** Remove a bank (used for swaps) |

`/install` and `DELETE` take `Authorization: Bearer <Hugging Face token>` and ask
HF `whoami` who it belongs to — only the Space owner's token passes. No shared
secret to provision. The BASE Station backend calls these from
`ingestDiffSingerVoicebank`, which decides who may install what.

## Installing voicebanks

Cantor ships with **no voicebanks**. It is an engine; a bank is the voice. Banks
are installed through `/install`, which downloads the archive, finds the folder
holding `dsconfig.yaml` (unwrapping nested "pack" zips), copies it into persistent
storage, then **validates it**: binds every acoustic/vocoder ONNX input by name and
sings a three-note test phrase. A bank that fails either step is deleted again —
a half-installed bank is an error, never a voice.

Supported layout is the **OpenUtau DiffSinger bank format**:

```
/data/voicebanks/<bank_id>/
    dsconfig.yaml        # acoustic, vocoder, phonemes, speakers, dictionaries, sample_rate, hop_size
    character.yaml       # display name
    acoustic.onnx
    phonemes.txt
    dsdict-en.yaml       # or dsdict.yaml / dictionary.txt — English preferred on multi-dict banks
    *.emb                # speaker embeddings for vocal modes (dsconfig `speakers`)
    dsvocoder/vocoder.onnx   # optional — most banks name a SHARED vocoder instead
    LICENSE              # <- read this before shipping the bank to users

/data/vocoders/<name>/vocoder.onnx   # shared vocoders, installed with kind: 'vocoder'
```

Resolution order for the vocoder: bank-local file → `/data/vocoders/<dsconfig name>`
→ any installed shared vocoder. Install the OpenVPI `pc_nsf_hifigan_….oudep` (it is a
zip of `vocoder.onnx` + `vocoder.yaml`) once and every bank without its own works.

Acoustic inputs Cantor supplies: `tokens`, `durations`, `f0`, `languages`,
`spk_embed`, `gender` (0), `velocity` (1), `speedup` (10), `steps` (20), `depth`.
A bank that REQUIRES `energy` / `breathiness` / `voicing` / `tension` curves is
refused at install — Cantor has no variance model to predict them, and feeding
constants would make it sing wrong on purpose.

`/voicebanks` reports `renderable: false` for any bank missing a required model
rather than hiding it, so a half-installed bank shows up as a diagnosable problem
instead of vanishing.

### Licence reality check (Sep 2026)

Genuinely permissive **English** DiffSinger banks are rare. The DiffSinger wiki lists
five English-capable banks: Hanami Hoshino (Team L❤VE licence — commercial use and
derivatives allowed, attribution required), Laru Mine (commercial with permission,
no redistribution), TIGER and Canary (CC BY-NC-ND + Commons Clause), Peiton
(commercial with paid licence). Separately, the **community vocoder every bank
depends on (OpenVPI NSF-HiFiGAN / PC-NSF-HiFiGAN) is CC BY-NC-SA 4.0** — so a
commercial release path requires either a bank that bundles its own permissively
licensed vocoder or a vocoder we train ourselves. Pretrial test mode is
non-commercial and unaffected.

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