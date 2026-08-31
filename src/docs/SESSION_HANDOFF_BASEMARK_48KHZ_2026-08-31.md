# Session Handoff — Skye 48kHz + BASE Mark V2 verification (2026-08-31)

Checkpoint written at the user's request before a round of model adjustments.
Everything below is measured, not assumed. Resume from "Open next steps".

---

## 1. What was broken, and what actually caused it

### Bug A — every Skye render reported 0Hz / 0ch / 0-bit
`readWavFormat()` in `base44/shared/skyeEngine.ts` read the WAV format block at
FIXED offsets (22 / 24 / 34), which assumes `fmt ` begins at byte 12.

Skye's Space writes output via **soundfile**, which prepends a **52-byte `JUNK`
padding chunk before `fmt `**. Real chunk layout of a Skye render:

    RIFF@0 · WAVE@8 · JUNK@12 (52 bytes) · fmt @72 · data@96

So the old reader was parsing inside `JUNK`'s zero fill and returned
`0 / 0 / 0` for every single render. That is why `sample_rate: 0` appeared in
generation logs — it was never cosmetic, it was a parser failure.

**Fix:** the reader now WALKS the chunk list for `fmt ` and `data`.
Duration is measured from the `data` chunk size rather than `buf.length - 44`,
since the header is not a fixed 44 bytes here.

Verified against a real render:

| reader | channels | sampleRate | bitDepth | duration |
|---|---|---|---|---|
| old (fixed offsets) | 0 | 0 | 0 | — |
| new (chunk walk) | 2 | 48000 | 16 | 92.2s |

### Bug B — the 48kHz BASE Mark skip guard
`pollSkyeJob` skipped BASE Mark whenever `sampleRate === 48000`, sentinelling the
asset with `base_mark: { skipped: true, reason: 'skye_48khz_pending_v2_rate_support' }`.

**Critical interaction:** because Bug A made `sampleRate` always `0`, that guard
had NEVER ONCE FIRED. Fixing the reader alone would have *newly activated* a
guard that disables marking which demonstrably works — a regression introduced by
a bugfix. **Both fixes had to land in the same change, and they did.**

### Bug C — the V2 benchmark harness was itself broken
`benchmarkBaseMark` had **missing `await`s** in the V2 path. Consequence: any V2
robustness numbers produced before today were measuring a broken embed and must
be treated as void. The four rows recorded today are the first trustworthy V2
data in the project.

---

## 2. The 48kHz premise was false — measured

The long-standing "V2 cannot recover a mark from a 48kHz master" belief was never
measured. It is wrong for the current V2 container, which embeds via a **44.1kHz
delta added back to the untouched master** (`src/docs/basemark-v2-neural/predict.py`),
so the master's own rate/depth/channels survive untouched.

Synthetic 20s source, `benchmarkBaseMark` `v2_start` → `v2_attack`,
rows persisted to `BaseMarkBenchmark`:

| attack | 44.1kHz spectral | 44.1kHz neural | 48kHz spectral | 48kHz neural | combined |
|---|---|---|---|---|---|
| control (untouched) | ✅ 0.0583 | ✅ | ✅ 0.0599 | ✅ | ✅ both |
| lowpass 15kHz | ✅ | ✅ | ❌ | ✅ | ✅ both |
| noise 20dB SNR | ✅ | ❌ | ✅ | ❌ | ✅ both |

Marked file returned at **48000 / 2ch / 16-bit** — rate, depth and channel count
all intact.

**Reading:** 48kHz tracks 44.1kHz on every case measured. The failures are
**layer-specific, not rate-specific** — noise defeats the neural layer at BOTH
rates; 15kHz band-limiting defeats spectral only at 48kHz (band-edge, expected).
In every case the OTHER layer carried it. `combined = true` throughout. That is
the cascade working exactly as designed, and it is a stronger claim than any
single layer's survival rate.

---

## 3. Changes landed this session

- `base44/shared/skyeEngine.ts` — `readWavFormat()` walks chunks; duration
  measured from the `data` chunk.
- `base44/functions/pollSkyeJob/entry.ts` — 48kHz skip guard **removed** (not
  inverted), with the measurement rationale recorded inline. Skye renders now
  flow into the "Auto BASE Mark V2 on new audio assets" workflow like any other
  track. The `base_mark.skipped` sentinel is gone from new assets.
- `src/docs/basemark-v2-neural/predict.py` — the "UNVERIFIED until benchmarked"
  docstring replaced with the results table above, plus the remaining gaps.
- `benchmarkBaseMark` — missing `await`s in the V2 path fixed (Bug C).
- Data repair: the one affected smoke-test pair (`GenerationJob`
  `6a94e3dd4a43fb4f2aa87462`, `UserAsset` `6a94e40ed1f3b17f626f8b1f`) corrected
  from `sample_rate: 0` to `48000 / 2ch / 16-bit`.

**Resolved known issues:** "48kHz masters cannot be BASE Marked" and
"cosmetic sample_rate metadata issue in generation logs" — both closed, the
second was never cosmetic.

---

## 4. Standing opinion (for when we resume)

- **Drop "bulletproof" as the goal.** A watermark cannot be made unbreakable.
  The achievable and more defensible goal is **known** — measured survival per
  attack per layer, with the cascade covering each layer's gaps. Today's data
  already demonstrates that.
- **The real systemic fault was folklore, not DSP.** A claim about the watermark
  lived for months in the known-issues list with no measurement behind it, and
  the harness that would have tested it was broken. Claims about forensic
  behavior need to be measurements or they need to be labelled as untested.
- **Borrow Print's false-positive discipline.** BASE Print reports per-duration-
  bracket rates and separates `advisory` from `attribution` standing. BASE Mark
  has no equivalent. V2's message carries an **8-bit validity tag ≈ 1-in-256 odds
  a random decode looks valid**, closed only by registry confirmation. That is
  the weakest statistical link in the chain and it is unquantified. A wrong
  attribution costs far more than a miss.

---

## 5. Open next steps (not started — resume here)

1. **Full attack grid at 48kHz** — pitch shift, time stretch, crop, bit-depth
   reduction. Only control / lowpass_15k / noise_20db are measured so far.
2. **Null-corpus false-positive pass for V2**, now that the harness works.
   Quantify the 8-bit tag collision rate against unmarked audio.
3. **24-bit 48kHz masters** — entirely unmeasured. A gap in coverage, not a
   known failure.
4. Skye engine's `sample_rate` now surfaces correctly in generation logs — worth
   a glance in the studio UI to confirm it renders as 48kHz for creators.

---

## 6. Still-open issues untouched by this session

Tempo-stretch (pitch-preserved) remains the unsolved forensic case. Fixed ladder
search range (±60 ppm) still fails on high-drift re-timing. 32-bit V1/V2 payloads
still lack production collision detection. `aiMastering` is still a stub. COS
still misflags human-recorded podcasts as low-humanity AI content.