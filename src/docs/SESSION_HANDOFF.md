# Session Handoff — BASE Print speech calibration

> **CLASSIFICATION: CONFIDENTIAL — TRADE SECRET. ADMIN EYES ONLY. DO NOT PUBLISH.**
> Do not import into any component; must not enter the client bundle.

**Written:** 2026-08-20. Read this plus the two docs it points at before resuming.

## Where we are

The **shared-intro confound is resolved.** The catastrophic same-show false-positive
result was caused by episodes sharing an intro stinger — a head window compares
literally identical audio — not by spoken word being unfingerprintable. `offset_seconds`
now threads through the whole path and same-show episodes at offset 300s behave like
entirely different voices.

**Beta accuracy, not lift, is the discriminator.** Head-window unrelated pairs produced
beta ≈ 1.0000 (accurate = genuinely shared audio); both clean runs produce betas wrong
by 30–86%. Lift alone cannot tell those apart — this is the second time absolute lift
thresholding failed (first was the n=6 music benchmark, which is why lift is demoted to
candidate generation only, permanently).

**Speech is not landmark-starved** — 98–102 hashes/second, comparable to music. The
density knob `PEAKS_PER_SECOND` stays frozen; reported, never tuned against.

## What changed this session (docs only — no code touched)

| File | Change |
|---|---|
| `src/docs/BASE_PRINT_SPEECH_CALIBRATION.md` | **New.** Full measurement record: three-regime table, runs of record, required methodology, blockers. |
| `src/docs/BASE_FINGERPRINT_DESIGN.md` | Corrected "design only, nothing ships" → deployed/advisory; fixed proposal-era constants to deployed ones; added measured-findings and sequence updates. |
| Both files | Confidential / trade-secret / admin-only classification banners. |

## Standing state

- `print_recovery.standing` stays **`advisory`**. Not promotable to `attribution`.
- Print evidence stays structurally separate from Mark evidence — a Print recovers no
  payload, so it must never be filed where it can be misread as attribution. Nothing in
  Print may alter `ai_disclosure_label` or the Creative Ownership Score.
- Telemetry (lift, beta, residuals) is admin/benchmark surfaces only, per
  `BASE_MARK_FORENSIC_SPEC` §4 — never on a creator-facing card.
- Deployed constants: 11025 Hz mono, FFT 512 / hop 128, bins 4–200, 20 peaks/s,
  fanout 4, Δt 0.02–2.0s. References undithered, queries dithered.
- `PRINT_VERSION` mismatch ⇒ blob **rebuilt, never compared**.

## Test invocation (the part that is easy to get wrong)

```
benchmarkBasePrint  action: "speech_specificity"
  seconds: 40
  offset_seconds: 300        // NEVER 0 for same-show material
  orvo_sources: [{id,url}]   // reported separately from freesound_sources — never pooled
```

- `action: "parity"` must be run at **offset 0** after every container rebuild; no remote
  print is trusted until it passes.
- `printsFor` falls back local → container on any local failure, so an over-long offset
  can silently yield a shorter tail window — **check `duration_seconds` per row**.
- `offset_seconds` requires the rebuilt container (`speedwolf2000/baseprint-extract`,
  pushed 2026-08-20). `BASE_PRINT_VERSION` must point at that digest or newer; an older
  one rejects the input, as Cog refuses unknown inputs.
- Serial / small batches only — concurrency crashes the decode worker on memory pressure.

## Next steps, in order

1. Widen ORVO run to all 10 episodes (90 cross-matches) at offset 300s.
2. Source a LibriVox / Archive.org public-domain narration null set; run as
   `freesound_sources`, reported separately.
3. Add `long_form` windows (full-episode references, not 40s slices).
4. Run speech **recall** under the pitch/stretch attack grid — specificity without recall
   is half a measurement; compare against **warped genuine** lifts, never self-lift.
5. Only then propose a combined lift-floor **plus** beta-plausibility acceptance rule, and
   measure it against all four populations before discussing promotion.

## Do not relitigate

Tempo-stretch inversion via watermarking (OLA resynthesis is not invertible), FSVC,
lift-only thresholding, in-app WASM/MP3 decoding, parallel concurrent scanning, and
whole-file decoding in the container. `NULL_CORPUS_STATUS.md` tracks V4 watermark null
scans — a **separate** measurement, unaffected by any of the above.