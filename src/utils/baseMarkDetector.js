// Client-side BASE Mark detector — a direct port of the platform's
// spread-spectrum detector, running on decoded Float32 samples so the
// public verifier works fully in-browser (the audio never leaves the device).
// Normalized correlation is amplitude-scale-invariant, so float [-1,1]
// samples behave identically to the backend's int PCM path.

const CHIP_LEN = 1024;
const BITS = 32;
const SEGS = BITS + 1;
const BLOCK = SEGS * CHIP_LEN;
const SEED_BASE = 0x0BA5E441;

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

/** Decode any audio file (WAV/MP3/OGG/M4A/…) to mono Float32 samples at 44.1kHz. */
export async function decodeFileToMono(file) {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: 1, sampleRate: 44100 });
  const buf = await ctx.decodeAudioData(arrayBuffer);
  const n = buf.length;
  const ch = buf.numberOfChannels;
  const out = new Float32Array(n);
  for (let c = 0; c < ch; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += d[i] / ch;
  }
  return out;
}

/** Scan mono Float32 samples for a BASE Mark. Same math as the backend detector. */
export function detectMarkInSamples(x) {
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
  };
}