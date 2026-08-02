# BASE Fingerprint — design proposal (not yet implemented)

Status: **design only.** Nothing in this document ships yet. It exists so the
approach can be argued with before any code is written.

## Why this, and why it is not a fourth watermark

BASE Mark has one structural gap: independent pitch shift and time stretch.
Resampling is invertible and deep scan already handles the exact-ratio cases.
Phase-vocoder stretching is *resynthesis* — the output is a new signal
reconstructed from spectral frames, not a warped copy of the input — which is
why the overlap-add inversion attempt failed. That was a category error, not a
tuning problem, and no amount of extra watermark strength addresses it.

A fingerprint attacks the problem from the opposite side. It embeds nothing. It
derives a compact description *from the audio itself*, chosen so the description
is unchanged by the exact transformations that break the watermarks.

**The honest limitation, stated up front:** a fingerprint match says *"this
strongly resembles registry track X."* A watermark says *"this file provably
carries our payload."* The first is evidence of similarity; the second is
evidence of provenance. Fingerprinting does **not** replace BASE Mark and must
never be marketed as if it does. It covers the case the watermarks lose.

## Two properties worth having

1. **It works on unmarked audio.** No embedding step, so it retroactively covers
   the entire back catalog, tracks that were never marked, and user uploads.
2. **It estimates the warp factor as a by-product.** This is the part that makes
   it more than a parallel system: the match stage recovers *how much* the audio
   was stretched or shifted. Feed that estimate back into the watermark
   detector, invert the warp once, and re-run — turning deep scan's brute-force
   candidate enumeration into a single targeted attempt. The fingerprint finds
   the file and the ratio; the watermark then supplies the actual proof. That
   feedback loop is the strongest argument for building this.

## Algorithm

### 1. Landmark extraction

STFT (~2048-sample window, 32ms hop) → log-magnitude → pick local spectral peaks
that dominate their time-frequency neighbourhood. Peaks survive compression,
EQ, noise and codec loss because they are the loudest, most structural parts of
the signal. Target density ~25–40 peaks/second.

### 2. Scale-invariant hashing (the important part)

Classic Shazam hashing pairs an anchor peak with a target and stores
`(f1, f2, Δt)` — all three of which change under pitch shift or time stretch,
which is precisely why naive fingerprinting is *not* invariant.

Use **triplets and ratios** instead. For three peaks `(t1,f1), (t2,f2), (t3,f3)`:

```
h1 = quantize( log(f2/f1) )        # invariant to pitch shift (both scale by α)
h2 = quantize( log(f3/f1) )        # invariant to pitch shift
h3 = quantize( (t3-t1)/(t2-t1) )   # invariant to time stretch (both scale by β)
hash = pack(h1, h2, h3)
```

A pitch shift multiplies every frequency by α, so frequency *ratios* are
unchanged. A time stretch multiplies every interval by β, so interval *ratios*
are unchanged. The hash is therefore invariant to both, independently — which is
exactly the attack BASE Mark cannot survive.

Cost: ratio hashes are less discriminative than absolute ones, so more
candidates come back per query and the verification stage does more work. That
tradeoff is the whole point and should be measured, not assumed.

### 3. Matching and warp estimation

Query hashes hit an inverted index → candidate `(track_id, anchor_time)` pairs.
For a genuine match, query times and reference times are related linearly:
`t_query = β·t_ref + offset`. Plot the pairs and a true match forms a **line**;
random collisions scatter. Fit by slope/offset voting (a coarse 2-D Hough
accumulator is sufficient).

The vote count is the match score. **The fitted slope β is the time-stretch
factor** — the value handed back to the watermark detector.

## Storage, and the part that will actually bite

At ~30 hashes/second a 3-minute track is ~5,000 hashes. Ten thousand tracks is
~50 million rows. That does not belong in entity storage, and pretending
otherwise would produce something that works in a demo and collapses in
production.

**Phase 1 (proposed):** store one packed binary fingerprint blob per asset as an
uploaded file, referenced from a small `AudioFingerprint` entity
(`asset_id`, `file_url`, `duration`, `hash_count`, `version`). Matching runs in a
backend function that loads candidate blobs and scans them. This is honestly
brute force, and it is fine up to a few thousand tracks — it is also enough to
prove or disprove the invariance claims above, which is what matters first.

**Phase 2 (only if Phase 1 earns it):** a real inverted index. That likely means
storage outside the entity layer, and it is a materially bigger commitment —
worth making only once the measured hit rate justifies it.

## What to measure before believing any of this

Run the same attack grid the watermark benchmark uses, so results are directly
comparable:

- Recall under pitch shift (±1, ±2, ±3 semitones) and time stretch (±5%, ±10%).
- Recall under the attacks the watermarks already survive — a fingerprint that
  is *worse* on compression and noise is not a useful complement.
- **False positive rate against a large set of unrelated audio.** This is the
  measurement most likely to kill the design, and therefore the one to run
  early. Ratio hashing is less specific than absolute hashing; if unrelated
  tracks collide, the whole approach is unusable regardless of its recall.
- Accuracy of the recovered β against the known stretch factor — the number that
  determines whether the watermark feedback loop actually works.

No figures should be published for any of this until measured, consistent with
how BASE Mark robustness is already handled.

## Sequence

1. ~~Benchmark V3 first.~~ **Done.** V3 measured 0% slot recovery under every
   pitch shift and time stretch tested, standalone on clean audio. It does not
   cover the gap. All three watermark layers share the same blind spot, and no
   fourth watermark layer is likely to change that — which promotes this design
   from "nice to have" to the only remaining approach on the table.
2. Prototype extraction + hashing offline; measure false positives and recall.
3. Only then wire up storage, indexing and the deep-scan feedback loop.