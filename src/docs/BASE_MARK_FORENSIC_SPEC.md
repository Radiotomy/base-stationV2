# BASE Mark — Forensic Integrity and Attribution Specification

**Document class:** Public technical specification (protocol-level)
**Engine:** BASE Mark — a unified two-layer signature (Spectral Layer + Neural Layer), stacked on every asset
**Last updated:** 2026-07-27

---

## 1. Purpose

BASE Mark is BASE Station's watermarking system: a single, inaudible, persistent
provenance signature embedded directly into the audio waveform of every master
(WAV/FLAC) saved on the platform. That signature is built from **two layers on
the same file** — a Spectral Layer (acoustic spread-spectrum DSP), embedded
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
| Persistence | Measured to survive metadata stripping, band-limiting, quantization, additive noise, cutting and stem separation. **Pitch-shifting and time-stretching defeat both layers** (measured 0% recovery) — this is a stated limitation, not a degradation |
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

## 7. Two-layer design & verification

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
  the benchmark environment cannot run a real MP3/AAC encoder, so no bitrate
  figures are published — only the measurable components of codec damage
  (band-limiting, quantization).
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