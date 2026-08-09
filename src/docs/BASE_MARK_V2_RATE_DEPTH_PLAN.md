# BASE Mark V2 — Sample Rate & Bit Depth Coverage Plan

**Status:** app-side guard landed 2026-08-09. Container change NOT yet pushed.
**Blocks:** 48kHz masters (all video-delivery audio), and any master whose bit depth
the container does not preserve.

---

## The problem, precisely

SilentCipher operates at **16kHz and 44.1kHz only**. A 48kHz master goes in and comes
back at 44.1kHz. `masterIntegrityError` in `base44/shared/baseMarkV2Finalize.ts` catches
that and keeps the original master unchanged, so nothing ships damaged — but the asset
gets no neural layer at all. It carries the spectral layer alone.

That is not a niche case. **Video audio is almost universally 48kHz**, so as long as V2
is 44.1k-only, every video deliverable we produce is single-layer.

### What the guard covers as of today

| Property | Checked | Behavior on mismatch |
|---|---|---|
| Sample rate | yes | fail, keep original |
| Channel count | yes | fail, keep original |
| **Bit depth** | **yes — added 2026-08-09** | fail, keep original |

Before that addition a 24-bit master returned as 16-bit passed every check and was
promoted to canonical. The guard is now closed on all three, so any container change
below is safe to attempt: if it degrades the master in any of these dimensions, the
finalizer refuses it rather than shipping it.

---

## The fix: band-split delta embedding (not a resample round trip)

The obvious approach — resample 48k→44.1k, embed, resample back — is wrong. It makes
the master itself a resampled copy, and every 48kHz mark would have survived a full
resample before it ever left us. That is a permanent fidelity cost on the canonical file.

**The V3 Drift Layer container already solves this exact problem** (`src/docs/basemark-v3-drift/predict.py`),
where WavMark is a 16kHz *mono* model and the master is 44.1/48kHz stereo. It never
resamples the master. It extracts the watermark as a **delta** and adds it back:

```
mono   = downmix(x)                      # full rate, untouched master x
m441   = resample(mono, sr -> 44100)
w441   = silentcipher_encode(m441, message)
delta  = resample(w441 - m441, 44100 -> sr)
out    = x + delta                       # per channel, original sr / depth / channels
```

The master is never resampled. Sample rate, bit depth, channel count and full bandwidth
are preserved exactly; only a perturbation in the band SilentCipher marks is added. The
detector recovers it by downmixing and resampling back to 44.1kHz, the same way V3's does.

This is the same architecture, proven in the same codebase, against the same class of
constraint. It should be a port, not a new design.

### Bit depth

Falls out of the delta approach for free — the master is never re-quantized, because we
add to the original samples rather than replacing them. The container must still write
the output at the source depth (`PCM_24` for 24-bit sources, as V3 does) rather than
defaulting to 16-bit.

---

## Open question the port must answer

V3's own file flags it, and it applies identically here: recombination is mathematically
lossless in the marked band, but **resampling ripple at the band edge may cost bit-recovery
accuracy**. SilentCipher's message is 40 bits with a magic byte, so a handful of flipped
bits is a total loss, not a degraded one — there is no partial credit.

So this is measured before it touches canonical audio, not after.

---

## Sequence

1. ~~Close the bit-depth hole in the integrity guard.~~ **Done 2026-08-09.**
2. **Port V3's band-split delta embedding into the V2 container**; write output at source
   sample rate, bit depth and channel count. Requires a `cog push` — cannot be done from
   the app.
3. **Benchmark 48kHz before enabling it.** Same grid as 44.1kHz: lossless first, then
   `mp3_128` / `aac_128`. A 48kHz recovery figure that is materially below the 44.1kHz
   figure means the band-edge ripple is real and the layer stays 44.1k-only.
4. **Extend the grid to video-delivery audio** — AAC 48kHz demuxed from MP4. Currently
   unmeasured entirely, and it is the format most of our video output ships in.
5. Re-dispatch the three known 48kHz assets that failed the guard (two from August, one
   from the 2026-08-09 batch) once step 3 passes.

## Standing constraint

The finalized V2 file is promoted to the asset's **canonical** audio. That is why the
guard fails loudly instead of accepting a close-enough master, and why step 3 gates step 5.
A missing neural layer is recoverable — a silently degraded master is not.