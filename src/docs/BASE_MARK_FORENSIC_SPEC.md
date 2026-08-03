# BASE Mark — Forensic Integrity and Attribution Specification

**Document class:** Public technical specification (protocol-level)
**Engine:** BASE Mark — a unified layered signature. Spectral Layer + Neural Layer are stacked on every asset; Drift Layer is opt-in; Speed Layer is in benchmarking
**Last updated:** 2026-08-02

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
industry-standard forensic requirements for tamper-resistant media tracking and
functions as a **technological protection measure (TPM)** under applicable
anti-circumvention statutes (17 U.S.C. § 1201 and international equivalents).

This document describes the *protocol* — what the mark asserts, how it is
verified, and its legal standing. The embedding mathematics, detection
thresholds, and cryptographic seeding are **proprietary trade secrets** executed
exclusively within BASE Station's secure server environment and are deliberately
not disclosed here.

## 2. What the mark asserts

A detected BASE Mark asserts exactly one fact: *this audio (or a derivative of
it) originated from a specific asset record in the BASE Station registry.* The
recovered 32-bit payload is cross-referenced against:

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
| Persistence | Measured to survive metadata stripping, band-limiting, quantization, additive noise, cutting and stem separation. **Pitch-shifting and time-stretching defeat the production layers** (V1/V2/V3, measured 0% recovery) — a stated limitation, not a degradation. The Speed Layer (§10) recovers resample-based re-timing but is not yet on the production path |
| Non-repudiation | Payload is threaded through the cryptographic manifest and on-chain anchor at embed time |
| Abstention | Detection thresholds scale with the evidence available, so the detector reports "insufficient evidence" instead of a low-confidence attribution |

## 4. Verification model (black-box)

Verification is offered as a **black-box service**: verifiers submit audio and
receive an outcome (detected / not detected), the recovered payload, and public
registry matches. Internal detection mechanics — alignment data, correlation
scores, decision thresholds — are never exposed, to prevent adversarial probing
and mark-removal tooling.

- **Public verifier** (`/verify`): free, no account required; only a short audio
  snippet is transmitted, processed in memory, and never stored.
- **Creator scanner** (BASE Mark Studio): authenticated; adds ownership context
  for the creator's own registry matches.

## 5. Legal standing

1. **Anti-circumvention.** BASE Mark is deployed as a technological protection
   measure. Knowing removal, alteration, or circumvention of the mark — or
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

## 6. Trade-secret boundary

The following are confidential and never published, exported, or shipped to
client devices:

- Chip/seed generation and any key material (rotatable via secure environment secret)
- Segment/block structure, embedding strength, and masking parameters
- Detection alignment strategy, correlation math, and decision thresholds

Public repositories, client bundles, and API responses are audited to exclude
these elements. Only outcome-level data crosses the trust boundary.

## 7. Layered design & verification (production layers)

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

This behavior is regression-tested by the internal attack benchmark: an earlier
build returned a confidently wrong payload from a 2-second excerpt, and the
benchmark now asserts that such inputs are declined while genuine 5-second
excerpts, 11kHz low-pass and 10dB-SNR noise still resolve at 100%.

## 10. Speed Layer (V4) — measured status

**Not production. Admin-only, under active benchmarking.** Nothing in this
section may be quoted in a creator-facing claim until the acceptance gate in §11
is enforced.

The Speed Layer is built on audiowmark and exists to close the one gap V1, V2 and
V3 provably share: resample-based re-timing, where all three measure 0%. It does
not have to be told what was done to the file — it **estimates the playback ratio
from the signal**, re-times, then decodes. It also carries the full 32-bit
registry payload inside a 128-bit message, so unlike the Drift Layer it points at
nothing: there is no slot indirection and no 65,536-asset ceiling. It runs
CPU-only, so there is no GPU cold start and no idle burn.

Measured standalone on a 90-second 48kHz stereo master (unmarked before V4, so
these are V4's own figures and not the cascade's):

| Transform | V1 | V2 | V3 | V4 |
|---|---|---|---|---|
| Clean round trip | 100% | 100% | 100% | **100%** |
| Pitch shift +1 semitone (resample) | 0% | 0% | 0% | **100%** |
| 44.1kHz master played at 48kHz | 0% | 0% | 0% | **100%** |
| Band-limiting / quantization / noise | 100% | 100% | 100% | **100%** |
| Pitch-preserved tempo stretch | 0% | 0% | 0% | **0%** |
| Crops under ~5s | declined | — | 100% (slot) | **0%** |

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

1. **Codify the acceptance threshold in the registry lookup.** Enforce a gate in
   the 0.45–0.50 bit-error band, in the lookup path itself rather than in each
   caller, so no route can accept a payload the gate would reject. Registry
   confirmation stays mandatory per §8: a payload matching no asset is discarded.
2. **Attribute recovered payloads to assets.** A recovered 32-bit payload must
   resolve to a `UserAsset` provenance record, so a V4 hit reads as an
   attribution rather than a hex string.
3. **Replace polling with webhook finalization**, consistent with V2/V3, so
   verification latency is not bounded by a poll interval.
4. **Then, and only then, promote V4 and publish.** Raise n, add source material
   and lower bitrates, measure the cascaded V1+V4 configuration, and only after
   that consider the default path and creator-facing claims.

Explicitly out of scope: pitch-preserved tempo stretching. No watermark layer we
have recovers it, and the honest answer is scale-invariant fingerprinting
(`BASE_FINGERPRINT_DESIGN.md`), not a fifth layer.