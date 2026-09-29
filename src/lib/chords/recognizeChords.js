// In-browser chord recognizer: FFT → 12-bin chroma → match against 24 triad templates,
// one estimate per beat, merged into segments. A lightweight stand-in for a BTC-style
// model: no server, no new licence, and it works on any rendered bed.
import { triadName, sameTriad } from '@/lib/chords/chordSymbols';

const N = 8192;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const a = i + k, b = a + len / 2;
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
}

function chromaAt(data, sr, center, binPc, win) {
  const re = new Float64Array(N), im = new Float64Array(N);
  const off = Math.floor(center - N / 2);
  for (let i = 0; i < N; i++) { const s = data[off + i]; re[i] = (s || 0) * win[i]; }
  fft(re, im);
  const c = new Float64Array(12);
  for (let k = 1; k < N / 2; k++) if (binPc[k] >= 0) c[binPc[k]] += Math.hypot(re[k], im[k]);
  return c;
}

function bestTriad(c) {
  const sum = c.reduce((a, b) => a + b, 0);
  if (sum < 1e-3) return null;
  let best = null, score = -1;
  for (let root = 0; root < 12; root++) {
    for (const minor of [false, true]) {
      const s = c[root] + 0.8 * c[(root + (minor ? 3 : 4)) % 12] + 0.8 * c[(root + 7) % 12]
        - 0.5 * c[(root + (minor ? 4 : 3)) % 12];
      if (s > score) { score = s; best = { root, minor }; }
    }
  }
  return best && { ...best, label: triadName(best) };
}

export async function recognizeChords(url, { bpm = 120 } = {}) {
  const buf = await (await fetch(url)).arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const audio = await ctx.decodeAudioData(buf);
  ctx.close();
  const sr = audio.sampleRate;
  const data = audio.getChannelData(0);
  if (audio.numberOfChannels > 1) {
    const r = audio.getChannelData(1);
    for (let i = 0; i < data.length; i++) data[i] = (data[i] + r[i]) / 2;
  }
  const win = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const binPc = Int8Array.from({ length: N / 2 }, (_, k) => {
    const f = (k * sr) / N;
    return f < 65 || f > 2100 ? -1 : (((Math.round(12 * Math.log2(f / 440)) + 69) % 12) + 12) % 12;
  });
  const beat = 60 / (bpm || 120);
  const segs = [];
  for (let t = 0; t < audio.duration; t += beat) {
    const c = new Float64Array(12);
    for (const q of [0.25, 0.5, 0.75]) {
      const part = chromaAt(data, sr, (t + q * beat) * sr, binPc, win);
      for (let i = 0; i < 12; i++) c[i] += part[i];
    }
    const chord = bestTriad(c);
    const end = Math.min(t + beat, audio.duration);
    const last = segs[segs.length - 1];
    if (last && sameTriad(last.chord, chord)) last.end = end;
    else segs.push({ start: t, end, chord });
    await new Promise((r) => setTimeout(r, 0)); // keep the UI responsive
  }
  return { segments: segs, duration: audio.duration };
}

/** Share of written time where the played triad matches. */
export function adherence(written, played) {
  let hit = 0, total = 0;
  for (const w of written) {
    for (const p of played) {
      const o = Math.min(w.end, p.end) - Math.max(w.start, p.start);
      if (o > 0) { total += o; if (sameTriad(w.chord, p.chord)) hit += o; }
    }
  }
  return total ? Math.round((hit / total) * 100) : 0;
}