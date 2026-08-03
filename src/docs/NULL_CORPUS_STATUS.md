# Null-Corpus Status — BASE Mark V4 False-Positive Measurement

**Last updated:** 2026-08-03
**Purpose:** running state of the false-positive (null) corpus, so work can resume without re-deriving context.

---

## Where we stand

**59 null scans. 0 false positives. 0 spurious pattern lines.**

Every scan is unmarked audio, ≥60s, speed search forced ON (`--detect-speed`), which is the
path most likely to hallucinate a pattern line. A detection on any of these rows would be a
failure; none occurred.

| `source_class` | Scans | False positives | Status |
|---|---:|---:|---|
| `ai_generated_codec` | 27 | 0 | Primary class — how we actually deliver |
| `ai_generated_wav` | 22 | 0 | Marking-stage class |
| `human_lossy_preview` | 4 | 0 | Confounded (codec + human) — cannot be quoted as a human figure |
| `human_lossless` | **2** | 0 | **OPEN — the publishing blocker** |
| `unknown` (legacy) | 4 | 0 | Pre-dates `source_class`; excluded from per-class reporting |

## The one open cell

`human_lossless` is the class a published false-positive rate needs, and it is **not filled**:

- **n=2 bounds the rate at roughly 78%.** Statistically indistinguishable from knowing nothing.
  It is a real data point in the right class, not yet a figure.
- **Neither of the two files is CC0.** From `pdx-cs-sound/wavs`:
  - `collectathon.wav` — "Collectathon — Opening Theme" by Tovatronica — **CC-BY, attribution required**
  - `hindrance-of-a-fish.wav` — by Aidan Akenson — listed upstream only as **"CC 4.0"**, variant
    unspecified; treated as attribution-required
  The repo's blanket "CC-0 unless otherwise indicated" does not cover these two — they are the two
  *otherwise indicated*. Both rows carry their license and required attribution in `notes`.
  This conflicts with our CC0-only rule for external benchmark material: fine for internal
  measurement, **needs a decision before either appears in a report.**

## Next step (agreed)

Professional CD-ripped WAVs, held on a separate drive, **to be uploaded by the user.** These are the
preferred path because:

- Lossless PCM, human-performed, modern digital masters — the acoustic profile the platform
  actually scans, which the 78rpm/Archive.org route explicitly does not provide.
- Owned outright: no attribution string attached to the headline number.

To scan them once uploaded, per file:

```
smokeBaseMarkV4  action: "null_scan"
  sources:      [{ url, seconds }]   // seconds required — the 60s gate is enforced pre-scan
  source_class: "human_lossless"
  codec:        "none"
  seconds:      60
  batch_size:   2                    // serial-ish; concurrency crashes the decode worker
```
then poll `action: "null_poll"` with the returned `jobs` and a `run_id` until `pending: 0`
(rows are only written once the whole batch resolves).

## Standing constraints (do not relitigate)

- **Run scans serially / small batches.** Concurrent decoding crashes the worker on memory pressure.
- **60s minimum, enforced pre-scan.** Shorter audio is an easier scan and would bias the null rate
  toward clean.
- **Report FPR per class and per codec, never blended.** Codec damage consumes the detector's
  decision margin, so lossy delivery is both the common case and the likeliest source of a
  spurious hit.
- **The rows do not store a source URL.** `BaseMarkBenchmark` has no such field, so per-row
  provenance currently lives in `notes` and is identified by creation order within a batch. Worth a
  first-class column if the corpus grows much further.

## Blocker this unblocks

Per `BASE_MARK_FORENSIC_SPEC.md` §11: until the null rate is characterized per class, the
0.45–0.50 bit-error acceptance gate is uncalibrated, and a V4 recovery is measurement rather than
evidence. V4 stays admin-only, unpublished, and off the production path until then.