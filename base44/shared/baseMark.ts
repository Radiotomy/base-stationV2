// BASE Mark v1 — BASE Station's own spread-spectrum audio watermark engine.
// Inspired by Meta's AudioSeal (localized, sample-level marking) but implemented
// as a pure-DSP pseudo-noise watermark that needs no ML runtime.
//
// Design:
// - The audio is divided into repeating blocks of 33 segments (1 pilot + 32 payload bits).
// - Each segment (1024 samples) carries one bit via a pseudo-random ±1 chip sequence
//   added at ~-24 dB below the local RMS (perceptual masking).
// - The payload repeats across the whole file, so any surviving contiguous chunk of
//   ~1.5s (stems, samples, cuts, remix layers) still carries the full 32-bit payload.
// - Detection finds block alignment via pilot correlation (survives arbitrary cuts),
//   then majority-votes each bit across all blocks.

export const BASE_MARK_VERSION = '1.0';

const CHIP_LEN = 1024;          // samples per bit segment
const BITS = 32;                // payload bits
const SEGS = BITS + 1;          // pilot + payload
export const BLOCK = SEGS * CHIP_LEN; // 33792 samples (~0.77s @ 44.1kHz)
const ALPHA = 0.06;             // watermark strength relative to local RMS
const MIN_ALPHA = 30;           // floor in int16 units so silence still carries signal
// Platform chip seed — overridable via the BASE_MARK_SEED secret (8 hex chars) so it
// can be rotated without a code change. WARNING: rotating the seed makes previously
// marked files undetectable with the new seed; only rotate deliberately.
const SEED_BASE = (() => {
  const env = (typeof Deno !== 'undefined' && Deno.env.get('BASE_MARK_SEED')) || '';
  const v = parseInt(env, 16);
  return Number.isFinite(v) && v > 0 ? (v >>> 0) : 0x0BA5E441;
})();

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const chipCache = {};
function getChips(segIndex) {
  if (!chipCache[segIndex]) {
    const rand = mulberry32(SEED_BASE ^ Math.imul(segIndex + 1, 0x9E3779B1));
    const chips = new Float32Array(CHIP_LEN);
    for (let i = 0; i < CHIP_LEN; i++) chips[i] = rand() < 0.5 ? -1 : 1;
    chipCache[segIndex] = chips;
  }
  return chipCache[segIndex];
}

// LEGACY payload derivation — 32-bit FNV-1a of an asset id.
//
// SUPERSEDED by baseMarkPayload.derivePayloadForAsset() as of Phase 1. Unkeyed
// and publicly computable, so it must NEVER be used to mint a new mark: doing so
// re-opens the forgery path (an attacker who knows an asset id can derive the
// payload) and skips collision detection. Retained solely so existing marked
// assets remain readable and reproducible.
export function payloadFromId(id) {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function payloadBits(hex) {
  const v = parseInt(hex, 16) >>> 0;
  const bits = [];
  for (let k = 0; k < BITS; k++) bits.push(((v >>> (31 - k)) & 1) ? 1 : -1);
  return bits;
}

// Minimal RIFF/WAVE parser (PCM 16/24-bit)
export function parseWav(bytes) {
  if (bytes.length < 44) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0) !== 0x52494646 || dv.getUint32(8) !== 0x57415645) return null;
  let pos = 12;
  let fmt = null, dataOffset = -1, dataLen = 0;
  while (pos + 8 <= bytes.length) {
    const id = dv.getUint32(pos);
    const size = dv.getUint32(pos + 4, true);
    if (id === 0x666d7420) {
      fmt = {
        audioFormat: dv.getUint16(pos + 8, true),
        channels: dv.getUint16(pos + 10, true),
        sampleRate: dv.getUint32(pos + 12, true),
        bitsPerSample: dv.getUint16(pos + 22, true),
      };
    } else if (id === 0x64617461) {
      dataOffset = pos + 8;
      dataLen = Math.min(size, bytes.length - dataOffset);
    }
    pos += 8 + size + (size % 2);
  }
  if (!fmt || dataOffset < 0) return null;
  return { ...fmt, dataOffset, dataLen };
}

function assertSupported(wav) {
  if (!wav) throw new Error('Not a valid WAV file. BASE Mark works on 16-bit or 24-bit PCM WAV audio — download the WAV version of your track first.');
  if (wav.audioFormat !== 1 || (wav.bitsPerSample !== 16 && wav.bitsPerSample !== 24)) {
    throw new Error('Only 16-bit and 24-bit PCM WAV audio are supported by BASE Mark.');
  }
}

// Depth-agnostic little-endian signed PCM sample access
function readSample(dv, off, bps) {
  if (bps === 2) return dv.getInt16(off, true);
  let v = dv.getUint8(off) | (dv.getUint8(off + 1) << 8) | (dv.getUint8(off + 2) << 16);
  if (v & 0x800000) v -= 0x1000000;
  return v;
}
function writeSample(dv, off, v, bps) {
  if (bps === 2) { dv.setInt16(off, v, true); return; }
  dv.setUint8(off, v & 0xff);
  dv.setUint8(off + 1, (v >> 8) & 0xff);
  dv.setUint8(off + 2, (v >> 16) & 0xff);
}

// Mono (channel-averaged) float samples for detection
function monoSamples(bytes, wav) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ch = wav.channels;
  const bps = wav.bitsPerSample / 8;
  const frames = Math.floor(wav.dataLen / (bps * ch));
  const out = new Float32Array(frames);
  for (let n = 0; n < frames; n++) {
    let acc = 0;
    for (let c = 0; c < ch; c++) acc += readSample(dv, wav.dataOffset + (n * ch + c) * bps, bps);
    out[n] = acc / ch;
  }
  return out;
}

// Embed payloadHex into a 16-bit or 24-bit PCM WAV. Returns new Uint8Array.
export function embedMark(bytes, payloadHex) {
  const wav = parseWav(bytes);
  assertSupported(wav);
  const out = bytes.slice();
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const ch = wav.channels;
  const bps = wav.bitsPerSample / 8;
  const maxV = bps === 2 ? 32767 : 8388607;
  const minV = -maxV - 1;
  const minAlpha = MIN_ALPHA * (bps === 3 ? 256 : 1);
  const frames = Math.floor(wav.dataLen / (bps * ch));
  const blocks = Math.floor(frames / BLOCK);
  if (blocks < 2) throw new Error('Audio is too short to watermark (about 2 seconds minimum).');
  const bits = payloadBits(payloadHex);
  for (let b = 0; b < blocks; b++) {
    for (let seg = 0; seg < SEGS; seg++) {
      const chips = getChips(seg);
      const sign = seg === 0 ? 1 : bits[seg - 1]; // pilot always +1
      const segStart = b * BLOCK + seg * CHIP_LEN;
      // local RMS (channel 0) for perceptual scaling
      let sumSq = 0;
      for (let i = 0; i < CHIP_LEN; i++) {
        const s = readSample(dv, wav.dataOffset + (segStart + i) * bps * ch, bps);
        sumSq += s * s;
      }
      const rms = Math.sqrt(sumSq / CHIP_LEN);
      const alpha = Math.max(minAlpha, rms * ALPHA);
      for (let i = 0; i < CHIP_LEN; i++) {
        const add = Math.round(sign * chips[i] * alpha);
        for (let c = 0; c < ch; c++) {
          const off = wav.dataOffset + ((segStart + i) * ch + c) * bps;
          let v = readSample(dv, off, bps) + add;
          if (v > maxV) v = maxV; else if (v < minV) v = minV;
          writeSample(dv, off, v, bps);
        }
      }
    }
  }
  return out;
}

// Minimum blocks required to attempt detection at all.
//
// This is a false-positive control, not a convenience limit. The pilot stage
// takes the MAXIMUM correlation over all 33,792 sample offsets, so its output is
// an extreme-value statistic: with K blocks of evidence the per-offset noise
// deviation is 1/sqrt(K*CHIP_LEN), and the max over N offsets lands near
// sqrt(2*ln N) ~= 4.6 of those deviations even on unmarked audio. At 2 seconds
// only K=1 block exists, putting the expected noise maximum around 0.14 — four
// times the old fixed 0.035 gate, so unmarked audio passed the gate by
// construction. With so few blocks there is also almost no majority-vote
// redundancy left, so the recovered bits were essentially random. That is the
// mechanism behind the measured 2-second false positive with a confidently wrong
// payload: the single most dangerous failure mode this detector can have, since
// a wrong attribution is far worse than no attribution.
//
// 4 blocks (~3.1s @ 44.1kHz) is the floor we attempt. Benchmarking already
// showed 3s recovery is content-dependent and 2s unreliable, so below this we
// decline to answer rather than guess.
const MIN_BLOCKS = 4;

// The pilot stage's job is only to RECOVER ALIGNMENT, not to decide detection.
// Because it maximizes over 33,792 offsets its genuine score sits close to its
// own noise maximum by construction (measured ~0.04-0.06 against a ~0.04 noise
// max at K=12), so scaling this gate up rejects real marks — it measurably broke
// 5-second crops and 11kHz low-pass, both of which carried strong payloads. It
// stays a loose sanity floor.
const PILOT_MIN = 0.035;

// The payload stage is the real discriminator and the gate that has to scale.
// bitCorr averages nc over `usable` blocks, so its noise deviation is
// 1/sqrt(usable*CHIP_LEN) and unmarked audio produces a mean absolute value near
// 0.8 of that. Genuine marks measure 4-7 deviations above it, so a 3-sigma gate
// separates them cleanly at every length: it admits the real 5s-crop payload
// (0.0606 vs a 0.0383 gate) while rejecting the 2-second noise case (~0.018
// against a 0.066 gate) that previously produced a confident wrong answer.
const STRENGTH_SIGMAS = 3.0;

// Detect a BASE Mark in a 16-bit PCM WAV. Survives arbitrary cuts because
// alignment is recovered by scanning every sample offset for the pilot.
export function detectMark(bytes) {
  const wav = parseWav(bytes);
  assertSupported(wav);
  const x = monoSamples(bytes, wav);
  const frames = x.length;
  const totalBlocks = Math.floor(frames / BLOCK);
  if (totalBlocks < MIN_BLOCKS) {
    return {
      detected: false,
      reason: 'Audio too short to scan reliably (about 3 seconds minimum). Shorter clips cannot be attributed with confidence, so no result is reported.',
      too_short: true,
    };
  }
  const pilot = getChips(0);
  const K = Math.max(1, Math.min(12, Math.floor((frames - CHIP_LEN) / BLOCK) - 1));

  // 1) Pilot alignment scan over one full block of sample offsets
  let bestO = 0, bestScore = -1;
  for (let o = 0; o < BLOCK; o++) {
    let corr = 0, energy = 1e-9;
    for (let b = 0; b < K; b++) {
      const start = o + b * BLOCK;
      for (let i = 0; i < CHIP_LEN; i++) {
        const s = x[start + i];
        corr += s * pilot[i];
        energy += s * s;
      }
    }
    const nc = corr / Math.sqrt(energy * K * CHIP_LEN);
    if (nc > bestScore) { bestScore = nc; bestO = o; }
  }

  // 2) Read payload bits at the recovered alignment, voting across all blocks
  const usable = Math.floor((frames - bestO) / BLOCK);
  const bitCorr = new Float64Array(BITS);
  let agreeCount = 0, voteCount = 0;
  for (let k = 0; k < BITS; k++) {
    const chips = getChips(k + 1);
    let sum = 0;
    const signs = [];
    for (let b = 0; b < usable; b++) {
      const start = bestO + b * BLOCK + (k + 1) * CHIP_LEN;
      let corr = 0, energy = 1e-9;
      for (let i = 0; i < CHIP_LEN; i++) {
        const s = x[start + i];
        corr += s * chips[i];
        energy += s * s;
      }
      const nc = corr / Math.sqrt(energy * CHIP_LEN);
      sum += nc;
      signs.push(nc >= 0 ? 1 : -1);
    }
    bitCorr[k] = sum / usable;
    const majority = bitCorr[k] >= 0 ? 1 : -1;
    for (const s of signs) { voteCount++; if (s === majority) agreeCount++; }
  }

  let v = 0;
  for (let k = 0; k < BITS; k++) v = (v << 1) | (bitCorr[k] >= 0 ? 1 : 0);
  const payloadHex = (v >>> 0).toString(16).padStart(8, '0');
  let strengthSum = 0;
  for (let k = 0; k < BITS; k++) strengthSum += Math.abs(bitCorr[k]);
  const meanStrength = strengthSum / BITS;
  const agreement = voteCount ? agreeCount / voteCount : 0;

  // Evidence-scaled gates. Each statistic is compared against its own noise
  // deviation for the amount of evidence actually available, so a short clip has
  // to clear a proportionally higher bar instead of inheriting a threshold that
  // was only ever valid for long files. The original fixed constants are kept as
  // floors so behavior on long, well-evidenced files is unchanged.
  const pilotGate = PILOT_MIN;
  const strengthGate = Math.max(0.02, STRENGTH_SIGMAS / Math.sqrt(usable * CHIP_LEN));
  const detected = bestScore > pilotGate && meanStrength > strengthGate;

  return {
    detected,
    payload_hex: detected ? payloadHex : null,
    // The decoded bits REGARDLESS of the gate decision. payload_hex stays gated
    // and is what callers should trust on its own; this is deliberately separate
    // and must never be reported to a user as a hit by itself, because on
    // unmarked audio it is simply 32 bits of noise.
    //
    // It exists for multi-window evidence combining: a single short window can
    // decode the correct payload while still failing its own gate (measured — a
    // seeded re-timed recovery landed at 0.033 against a 0.0377 gate), and the
    // only way to combine that with evidence from other windows is to see the
    // per-window decode even when it individually abstains. Two independent
    // windows agreeing on the same 32-bit value is a 2^-32 coincidence, which is
    // far stronger evidence than either window's strength alone.
    payload_candidate: payloadHex,
    pilot_score: Number(bestScore.toFixed(4)),
    mean_strength: Number(meanStrength.toFixed(4)),
    pilot_gate: Number(pilotGate.toFixed(4)),
    strength_gate: Number(strengthGate.toFixed(4)),
    agreement: Number(agreement.toFixed(3)),
    blocks_scanned: usable,
    sample_offset: bestO,
    version: BASE_MARK_VERSION,
  };
}