# BASE Print — Speech Calibration Record

**Last updated:** 2026-08-20
**Purpose:** the measurement record for whether the Print Layer's specificity holds on
spoken word. This is the gate on the Print-seeded episode path in ORVO. Everything
known about the Print Layer before this file was measured on **music at 20 seconds,
n=6**; podcasts violate both conditions, so nothing from the music calibration carries
over by default.

**Standing:** the Print-seeded episode path remains **advisory** (`print_recovery.standing
= "advisory"`). The findings below remove the reason to believe it *can't* work on
speech; they do not license promotion to `attribution`. See "What still blocks
promotion".

---

## Headline finding

**The catastrophic same-show false-positive result of 2026-08-19 was an artifact of the
shared intro stinger, not a property of spoken word.** A shared narrator does not create
a fingerprint match.

Every episode of a show begins with the same intro. A head window (offset 0) therefore
compares **literally identical audio** across two different episodes, and the matcher
correctly reports a strong match with an accurate warp estimate. That is the fingerprint
working, not failing — but read as an unrelated-pair false positive it looked like the
design was dead on speech.

Once the analysis window starts past the intro, same-show episodes fall into the same
weak-match regime as four entirely different synthetic voices.

### The three regimes, side by side

| | Same-show, head window | Same-show, offset 300s | Distinct voices (4x Inworld) |
|---|---|---|---|
| Unrelated lift | 78–106 | **17.4–25.8** | 16–20 |
| Unrelated votes | 293–422 | **11–17** | 11–17 |
| Unrelated beta | 0.9996–1.0004 | **1.30–1.86** | 1.82–2.00 |
| Self lift | 582–1913 | 810–839 | 650–826 |
| False accepts | 4/4 | 3/3 | 4/4 |

**Beta is the diagnostic that separates the cases, not lift.** In the head-window run the
unrelated pairs produced *accurate* warp estimates (beta ≈ 1.0000, i.e. "these are the
same audio at the same speed") — the signature of genuinely shared content. In both
clean runs the betas are wrong by 30–100% and none are pinned at the search boundary,
which is the same behaviour as the music null distribution: a spurious geometric fit.

A lift figure alone cannot tell those two situations apart. This is the second time
absolute lift thresholding has proven insufficient (the first was the n=6 music
benchmark, which is why lift was demoted to candidate generation only).

## Secondary finding: speech is not landmark-starved

Measured **98–102 hashes/second** on ORVO episode audio, ~4000 reference hashes per 40s
window. This was a live risk — spoken word is spectrally sparser than music, with real
silence between phrases, so the extractor's rank-cull to a fixed peaks/second target
might have been culling from a much thinner candidate pool.

It is not. Speech yields a comparable amount of evidence to music.

**Consequence: the density knob (`PEAKS_PER_SECOND`) stays untouched.** Per the
calibration discipline, density is reported, never tuned against — and there is now no
measurement suggesting it needs to move.

## Runs of record

| Date | Material | Window | Result |
|---|---|---|---|
| 2026-08-19 | Same-show ORVO episodes, one narrator | head (offset 0) | Unrelated lift 78–106, betas ≈1.0000, 4/4 accept. **Invalid as a false-positive measurement** — shared intro. |
| 2026-08-19 | 4x Inworld voices (Bryce, Anjali, Jonah, Ashley), unique scripts, 40s | head (single-shot, no intro) | Unrelated lift 16–20, betas 1.82–2.00, 3/4 wrong by >80%. Clean discriminator signal. |
| 2026-08-20 | 3x same-show ORVO episodes (ep008/009/010), one narrator, 40s | **offset 300s** | Unrelated lift 17.4–25.8, betas 1.30–1.86, 100 hashes/s. Matches the distinct-voice regime. |

The 2026-08-20 run is the one that settles the confound: it holds the narrator constant
and removes only the shared intro. Result moved from the "shared content" regime to the
"unrelated" regime, which isolates the intro as the entire cause.

## Test methodology — required, not optional

**Never measure speech specificity on a head window for same-show material.** The
`offset_seconds` parameter exists for exactly this reason and the harness now states
explicitly in its response when a head window makes the numbers uninterpretable.

```
benchmarkBasePrint  action: "speech_specificity"
  seconds:        40
  offset_seconds: 300          // past the intro; 0 is only valid for single-shot clips
  orvo_sources:      [{ id, url }]   // reported separately
  freesound_sources: [{ id, url }]   // never pooled with the above
```

- **Offset applies to both the reference and the dithered query**, so the two sides are
  never different regions of the same file.
- **The two corpora are reported separately on purpose.** Pooling lets a good rate on
  provenance-independent material hide a bad rate on real delivery format, or vice versa.
- **Per-bracket reporting.** A false-positive rate averaged across a 30-second clip and a
  45-minute episode describes neither.
- MP3 sources route through the `baseprint-extract` container; WAV/FLAC decode in-process.
  Both paths run identical constants — verified by `action: "parity"`, which must pass at
  **offset 0** after every container rebuild.

### Known asymmetry in the harness

`printsFor` tries local decode first and falls back to the container on any local failure.
An offset that runs past the end of a WAV/FLAC throws locally, then may succeed remotely
with a shorter tail window. Not a correctness problem for the hashes, but **check
`duration_seconds` per row** rather than assuming every row is the full window.

### Container dependency

`offset_seconds` requires the rebuilt `baseprint-extract` container. Confirmed live on
`speedwolf2000/baseprint-extract` (inputs: `audio`, `dither`, `max_seconds`,
`offset_seconds`; pushed 2026-08-20). `BASE_PRINT_VERSION` must point at that version or
newer — an older pinned digest rejects the input outright, since Cog refuses unknown
inputs.

## What still blocks promotion

The design is no longer suspect on speech. It is also **not calibrated**, and the gap is
now a threshold problem rather than a design problem.

1. **The acceptance gate is calibrated for music and is too loose for speech.** Every
   clean-run source still clears it (3/3 and 4/4). With self-lift ~820 against an
   unrelated ceiling of ~26 across both speech corpora (~31x margin), plus beta
   plausibility as a second filter, a separating rule clearly exists — it has not been
   written or measured yet.
2. **Sample size is far too small for a production threshold.** The 2026-08-20 run is
   n=3, 6 cross-matches, **one show, one narrator, `short` bracket only**. Enough to kill
   the shared-voice hypothesis; nowhere near enough to set a gate.
3. **No provenance-independent speech corpus yet.** LibriVox / Archive.org public-domain
   narration is needed so the calibration does not rest entirely on BASE Station's own
   catalog.
4. **No long_form measurement.** Every speech figure to date is a 40-second slice. The
   `long_form` and `extended` brackets — where a reference carries far more hashes and the
   geometric check faces more collisions — are unmeasured.
5. **No speech recall run.** Specificity without recall is half a measurement: a matcher
   that accepts nothing scores perfectly on false positives. The unrelated-lift ceiling
   must be compared against **warped genuine** lifts, never against self-lift, which is a
   trivially perfect upper bound.

Until 1–5 are closed, `print_recovery.standing` stays `advisory`, telemetry stays on
admin/benchmark surfaces only (per `BASE_MARK_FORENSIC_SPEC` §4), and a Print match is
reported as resemblance requiring human review — never as attribution.

## Next steps

1. Widen the ORVO run to all 10 episodes (90 cross-matches) at offset 300s.
2. Source a LibriVox null set; run it as `freesound_sources` alongside, reported separately.
3. Add `long_form` windows (full-episode references, not 40s slices).
4. Run speech **recall** under the pitch/stretch attack grid to get warped genuine lifts.
5. Only then propose a speech acceptance rule — lift floor **plus** beta plausibility — and
   measure it against all four populations before any promotion is discussed.