# Cantor Voicebank Plan — Dual-Path (Local + Hosted)

Status: APPROVED, not yet built. Written 2026-08-31.

## The decision

Creators get TWO ways to obtain a DiffSinger voicebank for Cantor:

1. **Local path** — the creator trains on their own NVIDIA GPU with DiffTrainer,
   then uploads the finished bank to us. Costs us nothing but an ingest endpoint
   and a guide.
2. **Hosted path** — we run a GPU training Space and absorb the cost. Metered
   and opt-in, primarily for the platform's own in-house bank plus creators who
   cannot train locally.

Both paths converge on the SAME artifact, which is why supporting both is cheap:
DiffTrainer's **OpenUtau export** produces exactly what Cantor already consumes
(`.onnx` acoustic + vocoder, `dsconfig.yaml`, phoneme list, dictionary). Cantor
does not need to know which path a bank came from.

## Why both, rather than picking one

- **Cost containment.** Training hours, not audio minutes, are the expense. A
  creator iterating through a dozen voice attempts spends their own electricity.
  Our GPU budget goes to the platform bank and to creators without hardware.
- **Provenance and biometrics.** A locally-trained bank means the creator's raw
  vocal never reaches our servers. "Your voice never left your machine" is a far
  stronger position than "we trained on it and deleted it afterwards." A voice is
  biometric data; minimizing what we hold is the correct default.
- **No lock-in either direction.** A creator who starts local can move hosted and
  vice versa, because the bank format is identical.

## Verified facts this plan rests on

Checked against the DiffTrainer repo (github.com/agentasteriski/DiffTrainer, by
AgentAsteriski and Ghinshi) and the OpenVPI/UTAU community, 2026-08-31:

- DiffTrainer bundles: `corpus_segmenter` (slices long wav/lab pairs),
  `liteconvert` (wav+lab -> wav/csv), **SOME** (pitch estimation), OpenVPI
  DiffSinger training, and **OpenUtau export scripts**.
- **An NVIDIA GPU is mandatory.** Every install path in its own README begins
  with a CUDA Toolkit requirement (11.8 / 12.1 / 12.4 / 12.6 / 12.8 / 12.9) and
  CUDA-enabled PyTorch >= 2.4, <= 2.8. Python 3.10.
- A *consumer* card is sufficient — this is not datacenter-GPU work. The
  community "no GPU needed" claim is FALSE; "no expensive GPU needed" is true.
- Community-quoted dataset size: **10-30 minutes** of sung audio, phoneme-labeled.
- The widely-repeated "**1 minute** is enough" figure is about a DIFFERENT
  technology — RVC / Applio / GPT-SoVITS / so-vits-svc timbre *conversion*, which
  repaints an existing vocal performance rather than singing a score. Do not
  conflate the two in any creator-facing copy.

## Known gap: labeling is not solved by DiffTrainer

DiffTrainer segments, converts, estimates pitch and trains. It does **not**
force-align phonemes — `.lab` files come from vLabeler by hand, or from SOFA
separately. This is the genuinely tedious part of the "30 minutes" figure.

Consequence for the hosted path: creators will assume a GPU training service
also solves labeling, because labeling is the hard part and it is not even GPU
work. Before building the hosted Space we must decide explicitly:

- (a) bundle an auto-aligner (SOFA) into the hosted pipeline, or
- (b) state plainly that the Space trains but does not label.

Do not leave this ambiguous. It is a scope decision, and it decides whether the
hosted path is a convenience or a support burden.

## Build sequence (deliberately ordered)

### Phase 0 — Prove inference before building any training (BLOCKING)
Cantor currently has no installed voicebank, so no newly-trained bank could be
evaluated even if it were perfect. Get ONE working bank installed and confirm
`POST /generate` returns audible, intelligible vocals from a LeadSheet score.

Until this passes, everything below is a factory with no product running through it.

Note: the MIT-licensed DiffSinger ONNX pair found on Hugging Face ships with no
phoneme list, dictionary or config. Those cannot be recovered from the model
file, so that pair can prove the plumbing runs and can NEVER produce intelligible
words. It is not a candidate for the platform bank.

### Phase 1 — Local path (cheap, do first)
- A voicebank ingest endpoint: accepts an OpenUtau-format bank (zip), validates
  that the required files are present and that the ONNX inputs match what Cantor
  expects, installs it into the Space, and registers it so `listDiffSingerVoicebanks`
  returns it.
- A guide page covering the real workflow: record -> label (vLabeler/SOFA) ->
  DiffTrainer -> export OpenUtau -> upload. State the CUDA requirement plainly.
- Explicitly NOT a "Train Locally" button. DiffTrainer is a desktop GUI; we
  cannot ship or launch it from a web app. Pretending otherwise creates a
  support problem. The local path is documentation plus an upload target.

### Phase 2 — Platform bank
Record an in-house singer under a proper work-for-hire agreement, label, train
(locally or hosted), and install as Cantor's default neutral bank. This is the
bank that makes score-adherent vocals available to every creator without anyone
needing to train anything.

### Phase 3 — Hosted GPU training Space (last, and metered)
- **Serial queue, one job at a time** — the same discipline Cantor, Cadence and
  Sever already use. Concurrent CUDA weight loading is what produced the
  "Cannot copy out of meta tensor" failures on Coda and Siren Song.
- **Per-creator training budget**, settable in the admin panel. Unmetered, this
  dies the first time somebody launches five 8-hour runs in parallel.
- Opt-in, never automatic.
- Resolve the labeling decision above before starting.

## Architectural note worth keeping

The strongest long-term shape is hybrid: **Cantor sings the authored melody with
a neutral bank** — which is what guarantees the notes are exactly the ones the
human wrote, i.e. the entire authorship claim — and then an RVC-style conversion
pass applies a specific creator's timbre from ~1 minute of their audio.

That delivers the "1-minute voice" promise AND score adherence, instead of
trading one for the other, and it means the expensive DiffSinger training only
ever has to happen once, for one in-house bank.