# BASE Fingerprint (BASE Print) — design and current state

**Last updated:** 2026-08-20

Status: **Phase 1 implemented and deployed, advisory only.** The extractor, the
matcher, the packed-blob registry and the seeded-recovery path all exist and run
in production (`basePrint.ts`, `basePrintMatch.ts`, `printRegistry.ts`,
`printSeededRecovery.ts`, plus the `baseprint-extract` container for MP3/large
FLAC decode). What has **not** happened is calibration: no acceptance threshold
has been earned on any material, so every result is surfaced as advisory
resemblance and nothing here may alter an AI disclosure label or a Creative
Ownership Score.

Two documents carry the measurement state and supersede the "what to measure"
section below where they overlap:

- `BASE_PRINT_SPEECH_CALIBRATION.md` — spoken-word specificity, the ORVO episode
  gate, and the confound history. **Read this before trusting any speech figure.**
- `BASE_MARK_FORENSIC_SPEC.md` §8 — what a Print match is permitted to claim.

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

STFT → log-magnitude → pick local spectral peaks that dominate their
time-frequency neighbourhood. Peaks survive compression, EQ, noise and codec loss
because they are the loudest, most structural parts of the signal.

**As shipped** (the proposal figures in earlier drafts of this document were
wrong — these are the deployed constants, mirrored constant-for-constant in the
container's `run.py`):

| Constant | Value |
|---|---|
| Target sample rate | 11025 Hz, mono |
| FFT size / hop | 512 / 128 |
| Bin range | 4–200 |
| `PEAKS_PER_SECOND` (rank-cull) | 20 |
| Fanout / triplet window | 4 peaks, Δt 0.02–2.0s |

Measured output density is ~100 hashes/second on both music and speech (the
rank-cull is on *peaks*, and each retained peak contributes several triplet
hashes). Speech was expected to be landmark-starved relative to music and
measurably is not — see the speech calibration record.

**The density knob is deliberately frozen.** It is reported in every calibration
run and never tuned against, because tuning it would invalidate every reference
blob already extracted.

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

**Phase 1 — IMPLEMENTED as described.** One packed binary blob (magic `BP01`,
20-byte header, 8 bytes per hash) per asset, uploaded as a file and referenced
from the `AudioFingerprint` entity. Matching loads candidate blobs in a backend
function and scans them. Honestly brute force, fine up to a few thousand tracks.

Two details that were decided during implementation and are load-bearing:

- **`AudioFingerprint` is deliberately NOT stored on `BaseMarkBenchmark` or
  `UserAsset.metadata`.** A Print recovers no payload; filing it alongside
  watermark-recovery records would let a resemblance match be misread as forensic
  attribution. Print evidence is structurally separated from Mark evidence for
  that reason alone.
- **References are stored undithered; only queries are dithered.** The asymmetry
  keeps the registry one size while letting a query emit boundary-straddling
  variants (2–4x hash count) to recover warped matches.

**Version discipline:** extraction constants are load-bearing for ratio
comparability, so `PRINT_VERSION` mismatch means a blob must be **rebuilt, never
compared**. The remote extractor rejects any blob whose version does not match the
runtime's.

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

## What has actually been measured (2026-08-20)

**The false-positive measurement predicted above as "most likely to kill the
design" did in fact fire — twice — and both times the correct response was to
narrow the claim rather than tune a threshold.**

1. **Music, n=6, 20s windows.** Genuine-warped and unrelated lift distributions
   **overlapped**. Absolute lift thresholding is therefore unusable as an
   acceptance rule, and lift was demoted permanently to **candidate generation
   only**. This is why the Print Layer feeds the spectral detector instead of
   reporting matches on its own.
2. **Speech.** An initial same-show episode run looked catastrophic (unrelated
   lift 78–106 with *accurate* beta ≈ 1.0000). Root cause was the **shared intro
   stinger** — a head window compares literally identical audio — not a property
   of spoken word. With the window moved past the intro, same-show episodes match
   the distinct-voice regime (unrelated lift 17–26, betas wrong by 30–86%).
   Full record and figures: `BASE_PRINT_SPEECH_CALIBRATION.md`.

**Beta accuracy, not lift, is the discriminator that survived both.** A genuine
match yields a plausible warp estimate; a spurious geometric fit yields one wrong
by tens of percent or pinned at the search boundary. Any future acceptance rule
must combine a lift floor **with** beta plausibility — a lift figure alone cannot
distinguish "unrelated audio" from "genuinely shared audio", which is precisely
the mistake the head-window run made.

Still unmeasured: speech **recall** (specificity alone is half a measurement),
`long_form`/`extended` brackets, and any provenance-independent speech corpus.

## Sequence

1. ~~Benchmark V3 first.~~ **Done.** V3 measured 0% slot recovery under every
   pitch shift and time stretch tested, standalone on clean audio. It does not
   cover the gap. All three watermark layers share the same blind spot, and no
   fourth watermark layer is likely to change that — which promotes this design
   from "nice to have" to the only remaining approach on the table.
2. ~~Prototype extraction + hashing offline; measure false positives and recall.~~
   **Done for music (n=6) and partially for speech.** Both false-positive runs
   narrowed the claim rather than validating a threshold; see above.
3. ~~Wire up storage and the deep-scan feedback loop.~~ **Done.** Blob registry,
   seeded recovery and the MP3/large-FLAC extraction container all ship. Indexing
   (Phase 2) has **not** been built and has not earned it.
4. **Current work — calibration, not construction.** Close the speech gate
   (widen n, add a null corpus, add long_form, run recall), then propose a
   combined lift + beta acceptance rule. Only a measured rule can move
   `print_recovery.standing` from `advisory` to `attribution`.