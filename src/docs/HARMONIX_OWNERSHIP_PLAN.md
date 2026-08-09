# BASE-Harmonix — Ownership Plan

**Status:** intent recorded, not yet started.
**Last updated:** 2026-08-09

Written to consolidate a plan that until now existed only as comments in
`base44/shared/harmonix.ts` and as a field description on the
`ModelTrainingSample` entity. Nothing here is new work — it is the existing
position written down, with the undecided parts explicitly marked open.

---

## 1. What "BASE-Harmonix" is today

A **product wrapper**, not a model we own.

| | |
| --- | --- |
| Base model | `fishaudio/ace-step-1.5` — a public Replicate model |
| Version | Pinned by digest in `HARMONIX_VERSION` |
| Ours | The name, the three tiers, the inference budgets, the credit costs, the prompt/lyrics construction, and the provenance treatment applied to the output |

The three tiers (`HARMONIX_TIERS` in `shared/harmonix.ts`) are **the same base
model at different inference budgets**:

| Tier | Steps | Max duration | Credits | Adds |
| --- | ---: | ---: | ---: | --- |
| Micro | 4 | 30s | 3 | Fast draft / preview |
| Pro | 27 | 120s | 10 | Core pipeline |
| Vault | 60 | 180s | 15 | + BASE Mark neural watermark + DDEX provenance (COS-verified) |

**Consequence to be aware of:** because it is a public model rather than one we
push, BASE-Harmonix will never appear under our Replicate account or
deployments. Only the BASE Mark containers (V2/V3/V4) do. The same is true of
BASE SoundForge (`stability-ai/stable-audio-2.5`). Their absence from the
dashboard is not a fault condition, and has already been mistaken for one.

## 2. Why owning a version is legally open to us

ACE-Step is **Apache 2.0** (verified 2026-08-02, github.com/ace-step/ACE-Step).

- Irrevocable; no revenue cap; no registration required
- Commercial use, modification and derivative works permitted
- **Fine-tunes (including LoRA) permitted**

So the model is safe to fork, wrap, and train on top of. This is the specific
reason ACE-Step was chosen over alternatives — Stable Audio Open 1.0 was
abandoned precisely because its Community Licence imposed a $1M revenue
threshold with no transparent enterprise pricing.

There is no licensing blocker to producing our own Harmonix weights.

## 3. What is already built toward it

### 3.1 Training telemetry — collecting now

The `ModelTrainingSample` entity exists solely to improve BASE-Harmonix, and is
written by the `logTrainingSample` function behind an explicit opt-in.

Its design constraint is the important part, and it is deliberate:

> Stores **NO audio** and no third-party provider output — only the prompt the
> user wrote, the settings they chose, and what they did with the result.

That keeps every row unambiguously ours to train on, with no licensing
exposure, across all providers. What it captures:

| Signal | Value for training |
| --- | --- |
| `prompt` | User-authored text — the input side of the pair |
| `lyrics_structure` | Section skeleton only (`intro,verse,chorus,…`), never lyric text |
| `genre`, `mood`, `duration` | Conditioning parameters |
| `used_masters_engine` | Whether the 243 Masters engine wrote the brief — lets us test whether Masters-formatted prompts outperform hand-written ones |
| `outcome` | Implicit label. `regenerated` is the strongest negative, `published` the strongest positive |
| `rating` + `rating_reason` | Explicit label; overrides `outcome` when present |
| `paired_with_id` | Links two generations from the same prompt — **a pair with a winner is a preference example, the format that actually feeds preference tuning** |
| `consent_version` | A row is only usable under the terms it was collected under |

### 3.2 Evaluation tooling

`compareAceStep` — backend function for comparing ACE-Step variants.

### 3.3 Container precedent

We already build, push and pin our own Cog containers on Replicate for BASE
Mark V2/V3/V4 (`src/docs/basemark-v*/`). The deployment path for a
self-hosted Harmonix is a path we have already walked, including the pin-by-digest
discipline that stops a `cog push` silently changing behaviour.

## 4. Standing constraints — do not relitigate

- **Never train on other commercial providers' outputs.** Violates their terms
  and undermines the BASE Mark / COS provenance guarantees. This is why
  `ModelTrainingSample` stores no audio and no provider output.
- **Opt-in consent is required before any generation data is used for
  training**, and consent is versioned per row.
- **Loops stay on SoundForge.** ACE-Step 1.5 is a *song* model and consistently
  inserts unwanted synth filler melodies over briefs asking for a bare drum
  loop. Song model for songs, audio model for loops — an owned Harmonix does
  not change this split.
- **Pin by digest.** Any self-hosted version must be pinned the way
  `BASE_MARK_V*_VERSION` is, for the same reason.

## 5. The path, in stages

Stage 1 is done. Nothing beyond it has started.

| Stage | What it means | Status |
| --- | --- | --- |
| **1. Wrapper** | Our tiers, prompts and provenance over the public model | **Shipped** |
| **2. Corpus** | Enough consented `ModelTrainingSample` rows — particularly *preference pairs* — to be worth training on | Collecting |
| **3. Self-host** | Push ACE-Step 1.5 as our own Cog container; identical behaviour, our infrastructure. Decouples us from the public model's availability | Not started |
| **4. Fine-tune** | LoRA over the base weights using the consented corpus | Not started |
| **5. Own weights** | BASE-Harmonix as a distinct model, not a configuration | Aspirational |

Stage 3 is separable from stage 4 and delivers value on its own — it removes
the dependency on a third-party model staying published, which is the risk that
prompted this document.

## 6. Open questions

Deliberately unanswered; recorded so they are not rediscovered later.

1. **Corpus threshold.** How many rows, and what ratio of preference pairs,
   before a fine-tune is worth the GPU spend? No target set.
2. **Tier mapping after a fine-tune.** Do Micro/Pro/Vault stay inference
   budgets over one set of weights, or become distinct weights?
3. **Cost model.** Self-hosting moves us from per-prediction billing to
   cold-start plus GPU time. Unmodelled — and cold starts already run to
   minutes for the V2 neural container, which is why embeds fire async.
4. **Evaluation.** What decides a fine-tune is *better*? `compareAceStep`
   exists but no acceptance bar is defined. Without one, "better" is a vibe.
5. **Provenance implications.** An owned model strengthens the COS/BASE Mark
   story — generation and provenance under one roof. Not yet articulated
   publicly, and should not be until stage 4 is real.

## 7. Related

- `base44/shared/harmonix.ts` — tiers, licence note, Replicate routing
- `base44/shared/soundForge.ts` — the loop engine and why it stays separate
- `base44/entities/ModelTrainingSample.jsonc` — telemetry schema
- `base44/functions/logTrainingSample/`, `base44/functions/compareAceStep/`
- `src/docs/basemark-v2-neural/` — Cog build precedent for self-hosting