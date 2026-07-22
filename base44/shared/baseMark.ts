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
const SEED_BASE = 0x0BA5E441;   // platform chip seed

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

// 32-bit FNV-1a hash of an asset id -> 8-char hex payload
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

// Minimal RIFF/WAVE parser (PCM 16-bit)
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
  if (!wav) throw new Error('Not a valid WAV file. BASE Mark v1 works on 16-bit PCM WAV audio — download the WAV version of your track first.');
  if (wav.audioFormat !== 1 || wav.bitsPerSample !== 16) {
    throw new Error('Only 16-bit PCM WAV audio is supported by BASE Mark v1.');
  }
}

// Mono (channel-averaged) float samples for detection
function monoSamples(bytes, wav) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ch = wav.channels;
  const frames = Math.floor(wav.dataLen / (2 * ch));
  const out = new Float32Array(frames);
  for (let n = 0; n < frames; n++) {
    let acc = 0;
    for (let c = 0; c < ch; c++) acc += dv.getInt16(wav.dataOffset + (n * ch + c) * 2, true);
    out[n] = acc / ch;
  }
  return out;
}

// Embed payloadHex into a 16-bit PCM WAV. Returns new Uint8Array.
export function embedMark(bytes, payloadHex) {
  const wav = parseWav(bytes);
  assertSupported(wav);
  const out = bytes.slice();
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const ch = wav.channels;
  const frames = Math.floor(wav.dataLen / (2 * ch));
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
        const s = dv.getInt16(wav.dataOffset + (segStart + i) * 2 * ch, true);
        sumSq += s * s;
      }
      const rms = Math.sqrt(sumSq / CHIP_LEN);
      const alpha = Math.max(MIN_ALPHA, rms * ALPHA);
      for (let i = 0; i < CHIP_LEN; i++) {
        const add = Math.round(sign * chips[i] * alpha);
        for (let c = 0; c < ch; c++) {
          const off = wav.dataOffset + ((segStart + i) * ch + c) * 2;
          let v = dv.getInt16(off, true) + add;
          if (v > 32767) v = 32767; else if (v < -32768) v = -32768;
          dv.setInt16(off, v, true);
        }
      }
    }
  }
  return out;
}

// Detect a BASE Mark in a 16-bit PCM WAV. Survives arbitrary cuts because
// alignment is recovered by scanning every sample offset for the pilot.
export function detectMark(bytes) {
  const wav = parseWav(bytes);
  assertSupported(wav);
  const x = monoSamples(bytes, wav);
  const frames = x.length;
  const totalBlocks = Math.floor(frames / BLOCK);
  if (totalBlocks < 2) {
    return { detected: false, reason: 'Audio too short to scan (about 2 seconds minimum).' };
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
  const detected = bestScore > 0.035 && meanStrength > 0.02;

  return {
    detected,
    payload_hex: detected ? payloadHex : null,
    pilot_score: Number(bestScore.toFixed(4)),
    mean_strength: Number(meanStrength.toFixed(4)),
    agreement: Number(agreement.toFixed(3)),
    blocks_scanned: usable,
    sample_offset: bestO,
    version: BASE_MARK_VERSION,
  };
}