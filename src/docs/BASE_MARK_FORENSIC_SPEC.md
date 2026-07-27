# BASE Mark — Forensic Integrity and Attribution Specification

**Document class:** Public technical specification (protocol-level)
**Engine version:** BASE Mark Cascade — V1 (acoustic) + V2 (neural), stacked on every asset
**Last updated:** 2026-07-27

---

## 1. Purpose

BASE Mark is BASE Station's watermarking system: an inaudible, persistent
provenance signature embedded directly into the audio waveform of every master
(WAV/FLAC) saved on the platform. As of this version, every new asset receives
**two cascaded layers on the same file** — V1 (acoustic spread-spectrum DSP) is
embedded first, then V2 (a learned neural-network watermark) is layered on top.
The two engines are orthogonal technologies, verified end-to-end (see §7) to not
interfere with one another when stacked, giving forensic redundancy: an attack
that defeats one layer typically leaves the other intact. It satisfies
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
| Localization | Any surviving contiguous chunk of a few seconds carries the complete identifier |
| Persistence | Survives metadata stripping, re-encoding, cutting, stem separation, sampling, remixing (robustness degrades under aggressive lossy compression and pitch/time transforms — see public docs) |
| Non-repudiation | Payload is threaded through the cryptographic manifest and on-chain anchor at embed time |

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

## 7. Version policy & cascade verification

- **V1:** pure-DSP spread-spectrum mark; instant, deterministic, no GPU
  dependency. Weakens under aggressive lossy re-encoding, pitch-shifting or
  time-stretching.
- **V2:** neural watermark, robust against the compression and pitch/time
  attacks that weaken V1. Runs asynchronously on a private GPU deployment
  (cold starts can take minutes; typically settles in under a minute once warm).
- **Cascade (current production behavior):** V1 is embedded first, then V2 is
  embedded on top of the V1-marked file, so the shipped audio always carries
  both signatures. An internal end-to-end smoke test synthesizes a test file,
  embeds V1, layers V2 on top, then re-runs both detectors against the final
  cascaded output — confirming V1 still resolves after V2 is applied, and V2
  resolves independently, with matching payloads on both layers. Legacy
  V1-only or V2-only marks remain fully traceable; payload semantics are
  unchanged across all layers.