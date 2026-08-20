# BASE Mark — Forensic Integrity and Attribution Specification

**Document class:** INTERNAL specification. Contains acceptance criteria, tolerance
values and calibration figures that sit inside the trade-secret boundary of §6 and
**must not be republished verbatim on a public surface.** The creator-facing
description of this system is the public BASE Mark documentation, which is written
from measured behaviour only.
**Engine:** BASE Mark — a unified layered signature. Spectral Layer + Neural Layer are stacked on every asset (production). Drift Layer is DECOMMISSIONED. Speed Layer and Print Layer are internal forensic reserve
**Last updated:** 2026-08-20

---

## 1. Purpose

BASE Mark is BASE Station's watermarking system: a single, inaudible, persistent
provenance signature embedded directly into the audio waveform of every master
(WAV/FLAC) saved on the platform. In production that signature is built from
**two layers on the same file** — a Spectral Layer (acoustic spread-spectrum DSP), embedded
first, and a Neural Layer (a learned neural-network watermark), layered on top.
The two layers are complementary technologies, verified end-to-end (see §7) to
not interfere with one another when stacked, giving forensic redundancy: an
attack that defeats one layer typically leaves the other intact. It satisfies
industry-standard forensic requirements for tamper-resistant media tracking. The
production layers are asserted as a **technological protection measure (TPM)**
under applicable anti-circumvention statutes (17 U.S.C. § 1201 and international
equivalents) — a claim that is **layer-scoped, not protocol-wide**, for the
licensing reason set out in §5.5.

This document describes the *protocol* — what the mark asserts, how it is
verified, and its legal standing. The embedding mathematics, detection
thresholds, and cryptographic seeding are **proprietary trade secrets** executed
exclusively within BASE Station's secure server environment and are deliberately
not disclosed here.

## 2. What the mark asserts

An **attributed** BASE Mark asserts exactly one fact: *this audio (or a derivative
of it) originated from a specific asset record in the BASE Station registry.*

**Detection and attribution are separate claims and are reported separately**
(§8.2). Detection is the signal-level fact that a valid signature was recovered;
attribution is the forensic claim, and it requires that payload to resolve to
**exactly one** registered asset. A recovered payload that matches no asset, or
that matches more than one, supports **no** assertion under this section — the
first is a false positive, the second names two works and therefore identifies
neither. Collapsing the two would let either case read as proof of ownership.

The recovered 32-bit payload is cross-referenced against:

1. The asset's **Provenance Manifest** (COS metrics, participation signals)
2. The asset's **DDEX AI-attribution bundle**
3. The asset's **ID3v2 provenance frames**
4. The **on-chain content hash** anchoring the marked audio bytes

The mark does **not** assert authorship quality, license status, or human/AI
participation on its own — those assertions live in the linked provenance
layers, which the mark makes discoverable even after metadata stripping.

## 3. Forensic properties (protocol-level)

| Property | Guarantee |
|---|---|
| Inaudibility | Signature is shaped below perceptual masking thresholds of the program material |
| Blind detection | No original/reference file is required to verify |
| Localization | The identifier repeats through the file; measured recovery is reliable from ~5s excerpts. Below ~3s the detector **declines to answer** rather than guess (see §8) |
| Persistence | Measured to survive metadata stripping, band-limiting, quantization, additive noise, cutting and stem separation. **Pitch-shifting and time-stretching defeat the production layers** (V1/V2, measured 0% recovery) — a stated limitation, not a degradation. The Speed Layer (§10) recovers resample-based re-timing but is held as internal reserve, not on the production path |
| Non-repudiation | Payload is threaded through the cryptographic manifest and on-chain anchor at embed time |
| Unforgeability | Payloads are keyed (HMAC-SHA256) and the Neural Layer's validity tag is cryptographic, so a mark cannot be *fabricated* for an asset. A mark **copied** from a genuine file is a separate, open problem — see §8.2 |
| Abstention | Detection thresholds scale with the evidence available, so the detector reports "insufficient evidence" instead of a low-confidence attribution |

## 4. Verification model (black-box)

Verification is offered as a **black-box service**: verifiers submit audio and
receive an outcome (`detected`), an attribution verdict (`attributed`) with a
machine-readable status and a plain-language explanation, the recovered payload,
and public registry matches. Internal detection mechanics — alignment data, correlation
scores, decision thresholds — are never exposed, to prevent adversarial probing
and mark-removal tooling.

- **Public verifier** (`/verify`): free, no account required; only a short audio
  snippet is transmitted, processed in memory, and never stored.
- **Creator scanner** (BASE Mark Studio): authenticated; adds ownership context
  for the creator's own registry matches.

## 5. Legal standing

1. **Anti-circumvention.** The Spectral and Neural Layers — the two production
   layers — are deployed as a technological protection measure. **The Speed Layer
   is excluded from this claim** (§5.5), and the retired Drift Layer no longer
   forms part of it. Knowing removal, alteration, or circumvention of the mark — or
   distribution of tools primarily designed to do so — may constitute a
   violation of anti-circumvention and copyright-management-information
   statutes (17 U.S.C. §§ 1201–1202; EU Directive 2001/29/EC arts. 6–7),
   independent of any underlying copyright claim.
2. **Copyright management information (CMI).** The payload, together with the
   linked provenance manifest, constitutes CMI. Its integrity is protected by
   the same statutes.
3. **Evidentiary use.** Detection reports produced by BASE Station's verification
   service, correlated with the on-chain anchor and manifest checksum, are
   designed to support chain-of-custody assertions in disputes.
4. **No certification.** A BASE Mark is a provenance and attribution instrument.
   BASE Station does not certify compliance with any third-party labeling
   standard; disclosure labels remain the legal responsibility of the
   disclosing artist (see RIAA AI Labeling Policy).

### 5.5 Engine licensing and the scope of the TPM claim

Verified upstream licences for each layer's engine:

| Layer | Engine | Licence | Effect |
|---|---|---|---|
| Spectral (V1) | BASE Station original | Proprietary — ours outright | No constraint |
| Neural (V2) | SilentCipher (Sony Research Inc., 2024) | **MIT** | Closed derivatives and commercial use permitted; copyright notice must ship with substantial portions |
| Drift (V3) | WavMark — **RETIRED 2026-08** | MIT | Removed from the codebase; no longer a licence surface |
| Speed (V4) | audiowmark (Stefan Westerfeld, 2018–2020) | **GPLv3 or later** | See below |

**The GPLv3 conflict.** GPLv3 §3 ("Protecting Users' Legal Rights From
Anti-Circumvention Law") states that no covered work "shall be deemed part of an
effective technological measure" under laws implementing WIPO Copyright Treaty
art. 11, and that conveying a covered work waives any legal power to forbid
circumvention. That clause exists specifically to prevent GPL software being used
as a technological protection measure, and it is therefore incompatible with
asserting TPM status over a cascade that includes the Speed Layer. The TPM claim
in §1 and §5.1 is consequently scoped to the Spectral and Neural Layers only —
which, since the Drift Layer's removal, is exactly the production cascade. The
scoping is therefore no longer a caveat about a shipped layer: **everything in
production is inside the claim, and everything outside the claim is internal
reserve.**

Two limits on the exposure, both material:

- GPLv3 has **no network-use clause** (that is AGPL). Running audiowmark
  server-side as a hosted service is not "conveying," so no source-disclosure
  obligation is triggered by current use, and BASE Station's own code is
  unaffected.
- The §3 waiver attaches on **conveying**. The container is not distributed to
  customers, so the waiver is not presently engaged — but shipping the container,
  an on-prem build, or a desktop tool would engage it.

**Attribution obligation.** MIT requires the copyright notice and permission
notice to accompany substantial portions of the software. A `NOTICES` file
carrying Sony's and WavMark's notices must ship with any container or artifact
that embeds them.

**Status:** the licence facts above are verified from upstream sources. The legal
characterisation is **not** legal advice and is flagged for counsel. Until
reviewed, no creator-facing or published claim may describe the Speed Layer as a
technological protection measure.

## 6. Trade-secret boundary

The following are confidential and never published, exported, or shipped to
client devices:

- Chip/seed generation and any key material (rotatable via secure environment secret)
- Segment/block structure, embedding strength, and masking parameters
- Detection alignment strategy, correlation math, and decision thresholds

Public repositories, client bundles, and API responses are audited to exclude
these elements. Only outcome-level data crosses the trust boundary.

## 7. Layered design & verification (production layers)

> **Decommissioned:** the Drift Layer (V3) was removed from the funnel in August
> 2026. It measured 0% against every re-timing attack — the gap it existed to
> close — and a pre-flight audit found **0 allocated slots and 0 assets carrying
> V3 metadata in any state**, so its removal could not cost a recoverable
> identity. Shared modules, backend functions, the slot entity, both Replicate
> deployments and the version secrets are removed. Container source is retained
> for rebuild. Full record: `BASE_MARK_V3_ARCHIVE.md`.

- **Spectral Layer:** pure-DSP spread-spectrum mark; instant, deterministic, no
  GPU dependency. Measured robust to band-limiting, 8-bit quantization and
  additive noise down to 10dB SNR; broken by pitch-shifting and time-stretching.
- **Neural Layer:** learned watermark (SilentCipher — Singh et al., Interspeech
  2024), trained against audio compression, time-jittering and additive white
  noise. Runs asynchronously on a private GPU deployment (cold starts can take
  minutes; typically settles in under a minute once warm). **It does not confer
  pitch/time robustness** — benchmarked at 0% recovery after a one-semitone
  pitch shift or a 5% time stretch, the same as the Spectral Layer.
- **Measured robustness.** All robustness figures published by BASE Station are
  produced by an internal attack benchmark that applies each distortion to a
  finished cascaded file and re-runs both detectors independently, counting a
  trial as recovered only on an exact payload match. No published figure is an
  estimate. Current runs use synthetic broadband material at small sample sizes;
  the benchmark environment cannot run a real MP3/AAC encoder for these layers,
  so no bitrate figures are published for them — only the measurable components
  of codec damage (band-limiting, quantization). Genuine encoder round trips are
  measured on the Speed Layer, whose container carries ffmpeg (§10).
- **Combined signature (current production behavior):** the Spectral Layer is
  embedded first, then the Neural Layer is embedded on top of that file, so
  the shipped audio always carries both. An internal end-to-end smoke test
  synthesizes a test file, embeds the Spectral Layer, layers the Neural Layer
  on top, then re-runs both detectors against the final combined output —
  confirming the Spectral Layer still resolves after the Neural Layer is
  applied, and the Neural Layer resolves independently, with matching payloads
  on both. Assets marked before this standard remain fully traceable; payload
  semantics are unchanged across all layers.

### 7.1 Verification funnel and the async completion path

Verification runs **cheapest-first and stops at the first confident hit**, in
`baseMarkVerify.ts`. Order is cost, not preference:

1. **Spectral** — in-memory, free, milliseconds. Always runs.
2. **Neural** — GPU, seconds, real money. **Opt-in per caller** (`allowGpu`).
   Anonymous public traffic is overwhelmingly misses, and each miss would
   cold-start a GPU, so the public verifier does not escalate by default.

A layer failure never fails the verification: a transient GPU error degrades the
funnel to the layers that did answer. Inputs the spectral layer declares too
short to analyse skip the GPU escalation entirely — no GPU layer can rescue audio
that contains insufficient evidence.

**Embedding completion is start → persist → finalize, never a blocking wait.**
The neural embed is asynchronous: the slot is claimed on the asset *before* the
prediction is started (so N concurrent requests yield at most one prediction),
the prediction id is stamped on the record, and completion arrives via a signed
webhook or a safety-net poller — both converging on one shared finalize module.
An unfulfilled claim expires after 15 minutes so a timed-out isolate cannot
strand an asset permanently.

**Cascade correctness is asserted, not assumed.** `smokeBaseMarkCascade` embeds
the spectral layer, layers the neural layer on top, downloads the finished file
and re-runs *both* detectors against it, requiring both to return the originally
embedded payload. A cascade is only viable when each layer resolves independently
on the combined output.

## 8. Abstention over guessing (false-positive discipline)

A wrong attribution is materially worse than no attribution: a miss is honest,
while a confident wrong answer can misdirect a real dispute. The Spectral Layer
detector is therefore built to abstain.

- **Evidence-scaled thresholds.** The payload decision threshold is derived from
  the noise deviation of the statistic *for the amount of audio actually
  supplied*, rather than a single constant tuned on long files. Short excerpts
  must clear a proportionally higher bar.
- **Minimum input length.** Below roughly 3 seconds the detector returns
  "insufficient evidence" and no payload. It does not return a best guess.
- **Search discipline.** Any detection produced by testing multiple candidate
  re-timings must clear a stricter bar than a single-shot detection, because
  testing N candidates otherwise multiplies the false-positive rate by N. The
  recovered payload must additionally match a registered asset; a payload
  matching no asset is discarded rather than reported.

### 8.1 Multi-window consensus, and the deliberate loosening of "agreement"

A re-timed recovery is inherently marginal: a single 12-second window frequently
decodes the correct payload while falling short of that window's own gate, and
the detector correctly abstains. The remedy is **more evidence at the same window
length**, not a lower bar — several non-overlapping windows are decoded at the
same candidate re-timing and combined. Windows are independent, so this adds
evidence without adding candidates, leaving the §8 search-discipline exposure
untouched. Two combined statistics must both hold:

1. **Payload consensus** across at least two windows.
2. **Mean correlation strength** clearing the strictest per-window gate among the
   agreeing windows, scaled by 1/√W for W agreeing windows — the standard
   noise-reduction result for independent measurements, which is why averaging is
   legitimate here while simply relaxing the gate is not.

**The loosening, stated plainly.** Agreement is defined as proximity in Hamming
space, **not byte equality**: two decoded payloads count as the same when they
differ by **at most 2 of 32 bits**. This was forced by measurement. On a re-timed
house master, one window decoded the payload exactly (the strongest window in the
set) and another decoded it with a *single* bit flipped; under strict equality the
tally split and the scan abstained on evidence that was plainly present. The same
file marks and detects at 100% clean, so the failure was in the rule, not the
watermark.

The cost is exactly quantifiable, and is why the slack is 2 and not more.
Allowing *d* bits widens the set of payloads treated as identical to Σ C(32,k)
for k ≤ d — at d=2 that is 1 + 32 + 496 = **529 of 2³² values**. Two independent
windows landing in one cluster is therefore a ~1.2 × 10⁻⁷ coincidence rather than
a ~2.3 × 10⁻¹⁰ one. That remains far below the strength gate's own false-positive
contribution, and **mandatory registry confirmation (§8) still applies on top**.
At d=4 the set grows to ~36,000 payloads and the clustering, rather than the
evidence, would be making the decision — so the tolerance is fixed in code and is
deliberately **not configurable**.

Cluster resolution is by per-bit majority across the agreeing windows, with ties
broken toward the strongest window, since window strength is the only available
evidence of which decode was less noisy.

**Measured false-positive behavior.** Null-mode runs (identical code path, embed
step skipped) across four masters and twelve candidate re-timings produced **zero
accepted results**. Every null cluster stayed at a single window; the bit slack
never manufactured agreement. Any accepted null row invalidates this rule and
forces recalibration.

**TPM relevance.** This rule governs when the Spectral Layer — a layer inside the
TPM claim of §5.1 — will assert an attribution. It is recorded here so the
acceptance criterion is documented at protocol level rather than existing only in
implementation comments.

### 8.2 The attribution gate (payload integrity and single-owner exclusivity)

§8.1 governs when the detector will assert it *recovered* something. This section
governs when the platform will assert that recovery **names an owner**. The two
were previously one decision applied per endpoint, which meant the answer to "is
this ours?" depended on which route was asked. All routes now resolve through one
module (`baseMarkResolve.ts`); no endpoint may implement its own rule.

**Enforcement is audited, not assumed.** Every payload→owner path was reviewed
against this rule: `verifyBaseMark`, `lookupBaseMark`, `detectBaseMark`,
`detectBaseMarkV2`, `deepScanBaseMark`, `printSeededEpisodeScan` and the V4 gate
all resolve through the single module. Three of them previously did not, and
their local lookups had failed in the two predictable ways — querying the
spectral index alone (so an asset marked only under the neural layer resolved as
*unregistered*, a false negative) and returning several rows as equals or
silently taking the newest (so a collision read as co-ownership or as a confident
wrong owner). Any new endpoint that resolves a payload must call this module; a
local `metadata.*.payload_hex` query is a defect by definition.

**Deliberately exempt: self-comparison.** `rescanAssetMark` and the benchmark
harnesses compare a detected payload against a payload *they already know* — the
asset's own registered value, or a planted test payload. That is an integrity or
measurement check, not an attribution, and routing it through the gate would
confuse "did this file keep its mark?" with "who owns this file?"

Four conditions, all mandatory:

1. **Keyed payload derivation.** Payloads are derived by domain-separated
   HMAC-SHA256 over the asset identifier under a server-side key, not by an
   unkeyed hash. This was adopted for the reason upstream recommends it (§11.6):
   an unkeyed payload over a known identifier is *derivable by anyone*, so it
   authenticates nothing.
2. **Cryptographic validity, not a structural heuristic.** The Neural Layer's
   validity byte is an HMAC-derived tag over the payload it accompanies. A message
   whose tag does not match its own payload does not unpack — the forgery fails at
   the **detector**, and is never carried inward as a flagged-but-valid hit.
3. **Registry corroboration.** A payload matching no registered asset is
   discarded, never reported as a hit (restating §8 as a gate condition).
4. **Single-owner exclusivity.** A payload resolving to more than one asset is an
   **abstention**, not a list of co-owners. 32-bit payloads have a birthday
   ceiling, so collisions are expected at scale rather than anomalous; derivation
   is collision-checked at embed time, and resolution refuses to guess when a
   collision exists anyway.

**Legacy format: retired, not tolerated.** Marks predating condition 1 carried a
published fixed magic byte and a publicly derivable payload — jointly sufficient
to mint a valid-looking mark for any asset. That format was read-only-tolerated
during migration, then contained by requiring the named asset to itself be
legacy-marked, then **eliminated**: every legacy mark record was retired from the
registry indexes (retaining a non-resolving audit stamp), after which the read
path was deleted. A message bearing the legacy magic byte is now rejected
outright. The corroboration branch is retained in code as a tested net should any
future layer introduce a weaker format.

**Fail-closed on key loss, deliberately.** With no legacy path remaining, an
absent payload key causes the Neural Layer to recover *nothing* rather than
degrading to unauthenticated reads. Silence is the correct failure mode for a
forensic instrument; the key is consequently load-bearing and cannot be rotated
without re-marking.

**Replay — closed for V4 only (Phase 6), open for V1/V2.** None of the above
resists a mark **copied out of a genuinely registered file** and pasted into
unrelated audio: the payload is real, the tag is valid, and the registry match is
correct. This was always a payload-width problem rather than a detector one, and
it is now resolved in the only layer wide enough to resolve it.

- **V1 and V2 remain exposed, permanently.** Their messages are 32 and 40 bits;
  neither can carry a per-copy identifier alongside the asset payload, and no
  resolution rule can distinguish a replayed mark from a genuine one. For these
  layers an attribution continues to assert *"this signature belongs to asset X"*
  and not *"this file is asset X"*, and any dispute turning on that distinction
  requires corroboration from the on-chain anchor (§2, item 4).
- **V4 carries a per-copy message.** audiowmark's 128 bits are now allocated as
  32-bit asset payload + 32-bit **copy id** + **64-bit keyed validity tag** over
  both. Each delivered file is marked with its own copy id and recorded as a
  `BaseMarkCopy` issuance naming the recipient, so recovered audio identifies the
  copy it came from — replay stops being anonymous and becomes the finding.

Three consequences worth stating precisely:

1. **The zero-tail heuristic is gone.** The retired format left-aligned the
   payload and zero-filled 96 bits, treating an intact zero tail as validity.
   That was a structural guess and was publicly reproducible. A 64-bit HMAC tag
   admits a random decode roughly 1 time in 1.8 × 10¹⁹, against the V2 tag's 1 in
   256 — which is why V2's residual false-accept rate had to be carried by
   registry confirmation and V4's does not. There were **zero V4-marked assets in
   the catalogue** when this landed, so the old format is rejected by name rather
   than dual-read (the Phase 3 discipline).
2. **A copy id is not self-certifying.** The tag proves *we* wrote the id; only
   the issuance record proves the id was ever issued and to whom. An id with no
   record resolves as `copy_not_on_record` — reported, never trusted — and a
   revoked copy still resolves, because a revoked copy in circulation is the
   result, not something to suppress.
3. **This does not promote V4.** The acceptance band is still uncalibrated on
   speech and on cascaded material, and `V4_PRODUCTION_APPROVED` remains false.
   Per-copy issuance is admin-only, and a V4 recovery may not back a
   creator-facing attribution until §11's gate is satisfied.

## 9. Deep scan (re-timed audio)

Resampling and time-stretching do not erase the mark, they **desynchronize** it:
the chip sequence is keyed to a fixed sample length, so once the time axis is
rescaled the detector cannot line it up. The mark is still present in the file.

The deep scan inverts the problem at detection time — the suspect audio is
re-timed by a curated set of inverse ratios and the standard detector is run at
each one. Measured results:

| Transform | Normal scan | Deep scan |
|---|---|---|
| 44.1kHz master played at 48kHz | 0% | **100%** |
| Pitch shift ±1 semitone | 0% | **100%** |
| Off-grid shift (e.g. +37 cents) | 0% | 0% (clean miss, no false payload) |
| Pitch-preserved tempo stretch | 0% | 0% |

Scope and hard limits, all measured:

- **Exact ratios only.** Tolerance is sub-sample — a pseudo-noise chip sequence
  decorrelates within roughly one sample of drift. A candidate 2 cents off
  recovers nothing, and a 0.04-cent discrepancy was enough to lose a genuine
  hit. Candidates are therefore declared as exact ratios with the cents derived,
  and a stepped search grid is useless: it only recovers a shift that happens to
  land exactly on a grid point.
- **Tempo stretching is unrecoverable.** Overlap-add resynthesis is not
  invertible; it discards the fine phase structure the chips live in, so undoing
  a stretch adds smearing rather than restoring alignment. Those candidates were
  removed rather than shipped at a permanent 0%.
- **Requires ≥12 seconds.** A re-timed recovery is marginal, and the payload gate
  tightens as block count falls: the same ±1 semitone shift that recovers at 100%
  from 12 seconds is rejected from 8. Shorter input is declined.
- **Bounded execution.** Candidates are processed in small batches across
  invocations. Running the full set in one request exceeds the CPU limit.
- **Registry confirmation is mandatory**, per §8 — searching many candidates
  multiplies false-positive exposure, so an unmatched payload is discarded.

An arbitrary, hand-dialed re-timing by an informed adversary remains out of
reach, and no detection-time search changes that.

### 9.1 Print-seeded recovery (measurement stage, not production)

The exact-ratio limitation above assumes the ratio must be *guessed*. The Print
Layer (`BASE_FINGERPRINT_DESIGN.md`) instead **estimates** it from the signal, and
that estimate can be handed to the Spectral detector. Measured across seven marked
masters (four uploaded, three generated) under three re-timing attacks:

| Attack | Recovered | Windows agreeing |
|---|---|---|
| 44.1kHz master played at 48kHz | 7 / 7 | 2–4 of 4 |
| 48kHz master played at 44.1kHz | 3 / 3 measured | 3–4 of 4 |
| Pitch shift +1 / +2 semitones | 6 / 6 measured | 3–4 of 4 |

Every recovery returned the exact payload and cleared its combined gate under
§8.1. Null runs on the same pipeline: **0 false positives in 12 rows**.

Two limits, both measured and both unresolved:

- **The Print estimate is not precise enough to use directly.** Observed error
  ranges from 7 to 1,266 parts per million of the ratio, while the Spectral
  recovery peak is roughly 20 ppm wide. A short correction ladder of cheap
  single-window probes locates the peak before the expensive multi-window
  confirmation is spent; a *fixed* ladder range is provably wrong, having already
  discarded a recoverable master whose correction sat at +1,270 ppm.
- **Estimate quality is self-reporting.** The 1,266 ppm outlier came with a match
  lift of 17.9 and a 10.28 ms residual, against 70.8 / 6.49 ms for a 12 ppm
  estimate on the same attack. Scaling the search budget from those two figures is
  the indicated fix; the trigger thresholds are **not yet calibrated** and must not
  be set from this sample size.

Until that calibration exists, Print-seeded recovery is a measurement instrument
and may not back a creator-facing attribution.

This behavior is regression-tested by the internal attack benchmark: an earlier
build returned a confidently wrong payload from a 2-second excerpt, and the
benchmark now asserts that such inputs are declined while genuine 5-second
excerpts, 11kHz low-pass and 10dB-SNR noise still resolve at 100%.

## 10. Speed Layer (V4) — measured status

**Not production. Admin-only, under active benchmarking.** Nothing in this
section may be quoted in a creator-facing claim until the acceptance gate in §11
is enforced.

The Speed Layer is built on audiowmark and exists to close the one gap the
production layers provably share: resample-based re-timing, where both measure 0%
(as did the retired V3). It does
not have to be told what was done to the file — it **estimates the playback ratio
from the signal**, re-times, then decodes. It also carries the full 32-bit
registry payload inside a 128-bit message, so unlike the Drift Layer it points at
nothing: there is no slot indirection and no 65,536-asset ceiling. It runs
CPU-only, so there is no GPU cold start and no idle burn.

Measured standalone on a 90-second 48kHz stereo master (unmarked before V4, so
these are V4's own figures and not the cascade's):

| Transform | V1 (prod) | V2 (prod) | V4 (reserve) |
|---|---|---|---|
| Clean round trip | 100% | 100% | **100%** |
| Pitch shift +1 semitone (resample) | 0% | 0% | **100%** |
| 44.1kHz master played at 48kHz | 0% | 0% | **100%** |
| Band-limiting / quantization / noise | 100% | 100% | **100%** |
| Pitch-preserved tempo stretch | 0% | 0% | **0%** |
| Crops under ~5s | declined | — | **0%** |

### 10.1 Real codec round trips

The Speed Layer container carries ffmpeg, so codec robustness is measured with an
actual encoder rather than approximated. Each row is an encode-and-decode-back
round trip — what happens to a track distributed as MP3 and scanned later. The
payload was recovered **exactly in all six runs**, including with codec damage
stacked on top of a pitch shift. Lower bit-error is better.

| Codec (128k) | Bit-error, clean | Bit-error, +1 semitone | Ratio recovered |
|---|---|---|---|
| MP3 | 0.306 | 0.069 | 1.059478 |
| AAC | 0.334 | 0.080 | 1.059477 |
| Opus | 0.299 | 0.300 | 1.059487 |

Three findings, stated as measured:

1. **Codec robustness holds, including through Opus**, which resamples
   internally, and holds when codec damage is combined with a speed change — with
   the ratio still estimated to five decimal places.
2. **Codec damage consumes most of the decision margin.** Genuine recoveries now
   reach ~0.34 bit-error; every spurious result across four runs has stayed at
   0.72 or worse. The conservative 0.45–0.50 acceptance band is therefore the
   *measured* answer, not caution — a 0.35 cut would have rejected all three
   genuine codec recoveries above.
3. **One row must not be over-read.** The MP3/AAC speed rows scored better than
   their clean counterparts (0.069 vs 0.306) because the speed search selected a
   cleaner block. That is block-selection variance at n=1, not evidence that
   codec-plus-speed is easier than codec alone.

### 10.2 Confidence limits on these figures

One master, one payload, 128k only, n=1 per cell. These are early figures, not a
robustness rate. Outstanding: higher n, additional source material across genres,
lower bitrates, and cascaded V1+V4 configurations (production would ship the
cascade, and V1's noise floor is not in these numbers).

**Corpus priority.** The material that matters is our own generative output in the
formats we actually deliver — lossless PCM at the marking stage, then MP3, AAC and
Opus/OGG on the way out. Lossless delivery is the minority case here, so a
false-positive rate measured only on PCM would describe the format our content is
least often distributed in. Codec damage is also what consumes the detector's
decision margin (§10.1), which makes lossy delivery both the common case *and* the
one most likely to produce a spurious hit. Null-corpus rows therefore record the
codec and bitrate as first-class fields and are reported per delivery format, never
blended. Outside human-produced material remains a secondary control for
provenance-independence, not the primary corpus.

### 10.3 Security posture during benchmarking

The audiowmark algorithm is public (GPLv3), so **the key is the only thing
separating our marks from marks anyone can read, locate or forge.** Accordingly:

- The watermark key lives in a server-side secret and is passed per call. It is
  never baked into a published container layer, never returned in an API
  response, and never reaches a client bundle.
- The container is pinned to an explicit version secret, so the marking algorithm
  cannot shift under us on a rebuild.
- Every benchmark entrypoint is admin-authenticated. Benchmark runs consume
  platform compute and use the production key, so they are not creator-reachable.
- Detector internals (bit-error, quality, block selection, estimated ratio) are
  benchmark telemetry. Per §4 they stay behind the trust boundary; the public
  verifier continues to return outcome-level data only.

## 11. Next critical phase — production acceptance gate

The container work is done; the remaining blocker is a decision rule. Until a
bit-error gate is enforced, a V4 recovery is measurement, not evidence, and
cannot back an attribution.

1. **Codify the acceptance threshold in the registry lookup — DONE.** The
   0.45–0.50 bit-error band is enforced in `baseMarkV4Gate.ts`, centrally rather
   than per caller. `abstain` is a first-class outcome: a decode landing inside
   the band reports "no determination" and is never rounded to a hit or a miss.
2. **Attribute recovered payloads to assets — DONE.** V4 carries the full 32-bit
   payload and resolves through the same single gate as V1/V2 (§8.2), so it
   inherits registry corroboration and single-owner exclusivity rather than
   reimplementing them. A promotion flag (`V4_PRODUCTION_APPROVED`, currently
   false) keeps promotion a single reviewed change that no endpoint can opt itself
   into.
3. **Replace polling with webhook finalization**, consistent with V2/V3, so
   verification latency is not bounded by a poll interval.
4. **Then, and only then, promote V4 and publish.** Raise n, add source material
   and lower bitrates, measure the cascaded V1+V4 configuration, and only after
   that consider the default path and creator-facing claims.

### 11.1 Open decisions raised by the licence and upstream-guidance audit

These three precede the work above, because each changes what the gate is built
around and would otherwise force a second migration.

5. **Speed Layer licence position (§5.5) — DECIDED.** Option (a): V4 is kept as an
   **internal forensic instrument, permanently excluded from the TPM claim**, and
   is not promoted to the default path. The owned-estimator migration (option b)
   and the HMAC payload migration below are **deferred until re-timed leakage is
   actually observed in the wild** — building either now would be speculative work
   against a threat we have not measured in production. Because the production
   cascade is now V1+V2 only, the TPM claim over everything we ship is already
   unqualified, which removes the urgency that made (b) attractive.
6. **Decide the payload format before more assets are marked — DONE (PHASE 6).**
   Keyed HMAC-SHA256 derivation and a cryptographic validity tag are live for
   V1/V2 per §8.2, with collision detection at embed time and the legacy format
   retired. The V4 message is now `payload | copy_id | 64-bit HMAC tag`, adopting
   upstream's recommendation that the message be an HMAC and using the surplus
   width for the per-copy identifier that closes replay for this layer. The
   decision landed at **zero V4-marked assets**, so no re-marking was required —
   which was the whole reason for deciding it before promotion rather than after.
7. **Look up every candidate pattern line, not just the best one.** Upstream
   specifies a registry lookup per emitted pattern line, treating an unmatched
   message as a decoding error. The container currently returns a single
   candidate, and because it prefers the aggregate `all` row *exclusively* when
   present, a correct individual block line is discarded whenever the merged row
   decodes wrong. This is a recall limitation concentrated in low-evidence cases
   and is the most likely explanation for the `crops under ~5s: 0%` row in §10;
   re-measure that row after the container returns all candidates. It does not
   affect the tempo-stretch result, which remains genuinely unrecoverable.

Explicitly out of scope: pitch-preserved tempo stretching. No watermark layer we
have recovers it, and the honest answer is scale-invariant fingerprinting
(`BASE_FINGERPRINT_DESIGN.md`), not a fifth layer.