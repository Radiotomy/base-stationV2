// BASE Mark — Print Layer (extraction).
//
// The Print Layer is the ONLY part of BASE Mark that embeds nothing. Every Mark
// Layer (V1 spectral, V2 neural, V3 drift, V4 speed) hides a signal IN the audio
// and is therefore destroyed when the audio is structurally resynthesized. The
// Print Layer derives a signature FROM the audio instead, chosen so the
// signature is unchanged by exactly the two transforms every Mark Layer
// measurably loses: independent pitch shift and pitch-preserved tempo stretch.
//
// ── WHAT IT MAY AND MAY NOT CLAIM ──────────────────────────────────────────
// A Print match says "this strongly RESEMBLES registry track X."
// A Mark recovery says "this provably CARRIES our payload."
// The first is evidence of similarity, the second evidence of provenance. The
// Print Layer is NOT a technological protection measure and must never be
// described as one — it protects nothing, it identifies. This distinction is
// load-bearing for the TPM claim in BASE_MARK_FORENSIC_SPEC.md §5 and is the
// reason the two engines stay separately named under the BASE Mark umbrella.
//
// ── WHY IT IS WORTH BUILDING ANYWAY ────────────────────────────────────────
// 1. It works on UNMARKED audio, so it retroactively covers the entire back
//    catalog, imported tracks and user uploads that no Mark Layer ever touched.
// 2. It recovers the warp factor as a by-product. Feed that back into the
//    spectral detector, invert the warp ONCE, and re-run — which turns deep
//    scan's brute-force ratio enumeration (which measured a sub-sample
//    tolerance, i.e. useless against a hand-dialed speed change) into a single
//    targeted attempt. The Print finds the file and the ratio; the Mark then
//    supplies the actual proof.
//
// NOTHING HERE IS MEASURED YET. Per the standing rule that killed the V3 drift
// claim and FSVC before it: no recall or false-positive figure from this module
// reaches a creator-facing surface until benchmarked. The measurement most
// likely to invalidate the whole design is the false-positive rate against
// unrelated audio (see the specificity note below), so that is the one to run
// first.

export const PRINT_VERSION = 1;
export const PRINT_MAGIC = 0x42503031; // "BP01"

// ── Analysis parameters ────────────────────────────────────────────────────
// Deliberately low sample rate. Peak structure lives in the low and mid bands;
// resampling to 11025Hz cuts FFT cost by 4x versus 44.1k and discards nothing
// the hash uses. Frequency RATIOS are unaffected by the resample as long as
// every print in the registry is extracted at the same rate — which is why this
// is a hard constant and not a parameter. Changing it invalidates every stored
// print, hence PRINT_VERSION.
export const TARGET_SR = 11025;
export const FFT_SIZE = 512; // 46ms window — short enough to localize transients
export const HOP_SIZE = 128; // 11.6ms — the time resolution the ratios inherit

// Peaks below ~86Hz are rumble/DC and above ~4.3kHz are the first thing a lossy
// encoder discards, so neither is a reliable landmark.
const MIN_BIN = 4;
const MAX_BIN = 200;

// Density control. More peaks means more hashes, more storage and more work in
// matching; fewer means less evidence per second. 20/sec is a starting point to
// be tuned by measurement, not a derived optimum.
export const PEAKS_PER_SECOND = 20;

// Triplet fan-out. Each anchor pairs with up to FANOUT following peaks, giving
// C(FANOUT,2) triplets per anchor. This is the single biggest cost knob:
// FANOUT 4 -> 6 hashes/anchor, FANOUT 8 -> 28. Quadratic, so raise it carefully.
const FANOUT = 4;
const MIN_DT = 0.02; // s — t2 must differ from t1 or the time ratio divides by ~0
const MAX_DT = 2.0; // s — beyond this, two peaks are not describing the same event

// ── Hash quantization ──────────────────────────────────────────────────────
// Frequency ratios are expressed in semitones because that is the scale the
// quantization error matters on. 0.5-semitone steps are deliberately COARSE:
// codec damage and noise move interpolated peak frequencies, and a finer step
// would turn small frequency wobble into a different hash (a miss). The cost is
// specificity, which is the tradeoff the false-positive benchmark exists to
// measure.
const SEMITONE_STEP = 0.5;
const SEMITONE_RANGE = 64; // clamp to +/- 64 semitones
const FREQ_BITS = 8;
const TIME_RATIO_BITS = 6;

// 22 bits total => ~4.2M distinct hashes. That is FAR less discriminative than
// classic Shazam-style absolute (f1,f2,dt) hashing, which is unavoidable: the
// invariance comes precisely from throwing away the absolute values. Unrelated
// tracks WILL collide on individual hashes. The design does not depend on hash
// uniqueness — it depends on the geometric consistency check in the matching
// stage (see basePrintMatch.ts), where genuine matches form a line and random
// collisions scatter. If unrelated audio still scores highly after that check,
// the approach is unusable and should be abandoned rather than tuned.

// ── Mono downmix + resample ────────────────────────────────────────────────
// Crude box-average low-pass before decimation. Not a proper anti-aliasing
// filter; adequate here because the hash reads peak POSITIONS, and residual
// aliasing lands well above the MAX_BIN ceiling. Worth revisiting only if the
// benchmark shows recall loss traceable to it.
export function resampleMono(samples, srcRate, dstRate = TARGET_SR) {
  if (srcRate === dstRate) return samples;
  const ratio = srcRate / dstRate;
  const outLen = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLen);
  const width = Math.max(1, Math.floor(ratio));
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    let sum = 0;
    let n = 0;
    for (let k = 0; k < width && start + k < samples.length; k++) {
      sum += samples[start + k];
      n++;
    }
    out[i] = n ? sum / n : 0;
  }
  return out;
}

// ── FFT ────────────────────────────────────────────────────────────────────
// Iterative radix-2, in place. Written out rather than pulled from a package
// because the Deno edge runtime has already burned us twice on audio packages
// that instantiate Workers or WASM internally and hang permanently
// (mpg123-decoder, wasm-audio-decoders). Plain arithmetic cannot do that.
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const ar = re[i + k];
        const ai = im[i + k];
        const br = re[i + k + half];
        const bi = im[i + k + half];
        const vr = br * cr - bi * ci;
        const vi = br * ci + bi * cr;
        re[i + k] = ar + vr;
        im[i + k] = ai + vi;
        re[i + k + half] = ar - vr;
        im[i + k + half] = ai - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

function hann(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

// ── Landmark extraction ────────────────────────────────────────────────────
// Two-stage: collect every local maximum in the time-frequency plane, then keep
// only the strongest per 1-second window. Culling by rank inside a window gives
// a stable peak DENSITY regardless of how loud the material is, which a fixed
// magnitude threshold does not — and density stability is what keeps hash counts
// (and therefore matching cost) predictable across a mixed catalog.
// Returns [{ t (seconds), f (Hz, sub-bin interpolated), mag (log) }].
export function extractPeaks(samples, sampleRate) {
  const mono = resampleMono(samples, sampleRate, TARGET_SR);
  const win = hann(FFT_SIZE);
  const nFrames = Math.max(0, Math.floor((mono.length - FFT_SIZE) / HOP_SIZE) + 1);
  if (nFrames < 3) return [];

  const nBins = FFT_SIZE >> 1;
  const spec = [];
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);

  for (let fr = 0; fr < nFrames; fr++) {
    const off = fr * HOP_SIZE;
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = mono[off + i] * win[i];
      im[i] = 0;
    }
    fft(re, im);
    const mags = new Float32Array(nBins);
    for (let k = 0; k < nBins; k++) {
      // log magnitude — peak PICKING is scale-free this way, so a quiet passage
      // still yields landmarks instead of being culled by a linear threshold.
      mags[k] = Math.log(Math.sqrt(re[k] * re[k] + im[k] * im[k]) + 1e-12);
    }
    spec.push(mags);
  }

  const candidates = [];
  const binHz = TARGET_SR / FFT_SIZE;
  const hiBin = Math.min(MAX_BIN, nBins - 1);
  for (let fr = 1; fr < nFrames - 1; fr++) {
    const cur = spec[fr];
    const prev = spec[fr - 1];
    const next = spec[fr + 1];
    for (let k = Math.max(MIN_BIN, 1); k < hiBin; k++) {
      const v = cur[k];
      // strict local max over the 3x3 time-frequency neighbourhood
      if (v <= cur[k - 1] || v <= cur[k + 1]) continue;
      if (v <= prev[k] || v <= next[k]) continue;
      // Parabolic interpolation across the magnitude peak. Without this the
      // frequency is quantized to 21.5Hz bins, and at low frequencies that is a
      // large enough error to push a genuine ratio into the wrong semitone bucket.
      const denom = cur[k - 1] - 2 * v + cur[k + 1];
      const raw = denom !== 0 ? (0.5 * (cur[k - 1] - cur[k + 1])) / denom : 0;
      const delta = Math.max(-0.5, Math.min(0.5, raw));
      const f = (k + delta) * binHz;
      if (f <= 0) continue;
      candidates.push({ t: (fr * HOP_SIZE) / TARGET_SR, f, mag: v });
    }
  }

  // Rank-cull per 1s window to the target density.
  const byWindow = new Map();
  for (const p of candidates) {
    const w = Math.floor(p.t);
    const arr = byWindow.get(w);
    if (arr) arr.push(p);
    else byWindow.set(w, [p]);
  }
  const kept = [];
  for (const arr of byWindow.values()) {
    arr.sort((a, b) => b.mag - a.mag);
    const top = arr.slice(0, PEAKS_PER_SECOND);
    for (const p of top) kept.push(p);
  }
  kept.sort((a, b) => a.t - b.t);
  return kept;
}

// ── Scale-invariant triplet hashing ────────────────────────────────────────
// The entire invariance argument, in three lines:
//   a pitch shift multiplies EVERY frequency by alpha -> frequency ratios are unchanged
//   a tempo stretch multiplies EVERY interval by beta -> interval ratios are unchanged
// so a hash built only from ratios survives both, independently. Classic
// (f1, f2, dt) hashing stores absolute values and therefore breaks under both,
// which is exactly why naive fingerprinting would not close this gap.
function quantizeSemitones(ratio) {
  const semis = 12 * Math.log2(ratio);
  const clamped = Math.max(-SEMITONE_RANGE, Math.min(SEMITONE_RANGE, semis));
  const idx = Math.round(clamped / SEMITONE_STEP) + Math.round(SEMITONE_RANGE / SEMITONE_STEP);
  return Math.max(0, Math.min((1 << FREQ_BITS) - 1, idx));
}

function quantizeTimeRatio(r) {
  // r = (t3-t1)/(t2-t1) and is > 1 by construction. Quantized in log space so
  // the relative error is constant across the range.
  const q = Math.round(Math.log2(Math.max(1.0001, r)) * 8);
  return Math.max(0, Math.min((1 << TIME_RATIO_BITS) - 1, q));
}

// Returns [{ hash, t }] where t is the anchor time in seconds.
export function hashPeaks(peaks, maxHashes = 400000) {
  const out = [];
  for (let i = 0; i < peaks.length && out.length < maxHashes; i++) {
    const a = peaks[i];
    // Collect the fan-out window once, then form every pair inside it.
    const fan = [];
    for (let j = i + 1; j < peaks.length && fan.length < FANOUT; j++) {
      const dt = peaks[j].t - a.t;
      if (dt < MIN_DT) continue;
      if (dt > MAX_DT) break;
      fan.push(peaks[j]);
    }
    for (let x = 0; x < fan.length; x++) {
      for (let y = x + 1; y < fan.length; y++) {
        const b = fan[x];
        const c = fan[y];
        const d12 = b.t - a.t;
        const d13 = c.t - a.t;
        if (d12 <= 0 || d13 <= d12) continue;
        const h1 = quantizeSemitones(b.f / a.f);
        const h2 = quantizeSemitones(c.f / a.f);
        const h3 = quantizeTimeRatio(d13 / d12);
        const hash = (h1 << (FREQ_BITS + TIME_RATIO_BITS)) | (h2 << TIME_RATIO_BITS) | h3;
        out.push({ hash, t: a.t });
        if (out.length >= maxHashes) return out;
      }
    }
  }
  return out;
}

export function computePrint(samples, sampleRate) {
  return hashPeaks(extractPeaks(samples, sampleRate));
}

// ── Blob serialization ─────────────────────────────────────────────────────
// One packed binary blob per asset, stored as an uploaded FILE and referenced
// from a small entity row. Deliberately not one entity record per hash: a
// 3-minute track is thousands of hashes, so a catalog of any size would be tens
// of millions of rows. That belongs in an index, not in entity storage, and
// pretending otherwise produces something that demos well and collapses in
// production. 8 bytes per hash: uint32 hash + uint32 anchor time in ms.
export function packPrint(hashes, durationSeconds) {
  const buf = new ArrayBuffer(20 + hashes.length * 8);
  const dv = new DataView(buf);
  dv.setUint32(0, PRINT_MAGIC);
  dv.setUint32(4, PRINT_VERSION);
  dv.setUint32(8, TARGET_SR);
  dv.setUint32(12, hashes.length);
  dv.setUint32(16, Math.round(durationSeconds * 1000));
  let o = 20;
  for (const h of hashes) {
    dv.setUint32(o, h.hash);
    dv.setUint32(o + 4, Math.round(h.t * 1000));
    o += 8;
  }
  return new Uint8Array(buf);
}

export function unpackPrint(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0) !== PRINT_MAGIC) throw new Error('Not a BASE Print blob');
  const version = dv.getUint32(4);
  const sampleRate = dv.getUint32(8);
  const count = dv.getUint32(12);
  const durationSeconds = dv.getUint32(16) / 1000;
  const hashes = [];
  let o = 20;
  for (let i = 0; i < count; i++) {
    hashes.push({ hash: dv.getUint32(o), t: dv.getUint32(o + 4) / 1000 });
    o += 8;
  }
  return { version, sampleRate, durationSeconds, hashes };
}