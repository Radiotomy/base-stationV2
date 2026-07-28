// Audio attack simulations for the BASE Mark robustness benchmark.
//
// Every attack here is implemented in pure DSP so it runs in the Deno runtime
// with no codec dependency. IMPORTANT for truthful reporting: each attack is
// named for EXACTLY what it does. We cannot run a real MP3 encoder here, so
// there is deliberately no "MP3 128k" attack — instead we expose the two
// measurable components of lossy-codec damage (band-limiting and quantization)
// under their own honest names.

import { parseWav } from './baseMark.ts';

function readNorm(dv, off, bps) {
  if (bps === 2) return dv.getInt16(off, true) / 32768;
  let v = dv.getUint8(off) | (dv.getUint8(off + 1) << 8) | (dv.getUint8(off + 2) << 16);
  if (v & 0x800000) v -= 0x1000000;
  return v / 8388608;
}

// WAV bytes -> { sampleRate, channels: Float32Array[] } normalized to -1..1
export function decodeWav(bytes) {
  const wav = parseWav(bytes);
  if (!wav || wav.audioFormat !== 1 || (wav.bitsPerSample !== 16 && wav.bitsPerSample !== 24)) {
    throw new Error('Benchmark input must be 16- or 24-bit PCM WAV.');
  }
  const bps = wav.bitsPerSample / 8;
  const ch = wav.channels;
  const frames = Math.floor(wav.dataLen / (bps * ch));
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const channels = [];
  for (let c = 0; c < ch; c++) channels.push(new Float32Array(frames));
  for (let n = 0; n < frames; n++) {
    for (let c = 0; c < ch; c++) {
      channels[c][n] = readNorm(dv, wav.dataOffset + (n * ch + c) * bps, bps);
    }
  }
  return { sampleRate: wav.sampleRate, channels };
}

// { sampleRate, channels } -> 16-bit PCM WAV bytes
export function encodeWav({ sampleRate, channels }) {
  const ch = channels.length;
  const frames = channels[0].length;
  const dataSize = frames * ch * 2;
  const out = new Uint8Array(44 + dataSize);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x52494646, false);
  dv.setUint32(4, 36 + dataSize, true);
  dv.setUint32(8, 0x57415645, false);
  dv.setUint32(12, 0x666d7420, false);
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, ch, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * ch * 2, true);
  dv.setUint16(32, ch * 2, true);
  dv.setUint16(34, 16, true);
  dv.setUint32(36, 0x64617461, false);
  dv.setUint32(40, dataSize, true);
  let o = 44;
  for (let n = 0; n < frames; n++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][n]));
      dv.setInt16(o, Math.round(s * 32767), true);
      o += 2;
    }
  }
  return out;
}

function mapChannels(audio, fn) {
  return { sampleRate: audio.sampleRate, channels: audio.channels.map(fn) };
}

// ── Attacks ────────────────────────────────────────────────────────────────

// Pitch shift by resampling: pitch moves by `semitones` and DURATION CHANGES
// inversely (the classic "speed it up to dodge fingerprinting" attack).
// Linear interpolation — this is what destroys chip-length alignment for a
// spread-spectrum mark.
export function pitchShiftResample(audio, semitones) {
  const ratio = Math.pow(2, semitones / 12);
  return mapChannels(audio, (x) => {
    const outLen = Math.floor(x.length / ratio);
    const y = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const p = i * ratio;
      const i0 = Math.floor(p);
      const frac = p - i0;
      const a = x[i0] || 0;
      const b = x[i0 + 1] ?? a;
      y[i] = a + (b - a) * frac;
    }
    return y;
  });
}

// Time stretch via overlap-add: DURATION changes by `factor`, pitch preserved.
// factor > 1 = longer/slower, < 1 = shorter/faster.
export function timeStretchOLA(audio, factor) {
  const WIN = 2048;
  const HOP_OUT = WIN / 2;
  const HOP_IN = Math.max(1, Math.round(HOP_OUT / factor));
  const win = new Float32Array(WIN);
  for (let i = 0; i < WIN; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (WIN - 1));
  return mapChannels(audio, (x) => {
    const steps = Math.max(1, Math.floor((x.length - WIN) / HOP_IN));
    const outLen = steps * HOP_OUT + WIN;
    const y = new Float32Array(outLen);
    const norm = new Float32Array(outLen);
    for (let s = 0; s < steps; s++) {
      const inOff = s * HOP_IN;
      const outOff = s * HOP_OUT;
      for (let i = 0; i < WIN; i++) {
        y[outOff + i] += x[inOff + i] * win[i];
        norm[outOff + i] += win[i];
      }
    }
    for (let i = 0; i < outLen; i++) if (norm[i] > 1e-6) y[i] /= norm[i];
    return y;
  });
}

// Bit-depth quantization — the quantization-noise half of lossy-codec damage.
export function bitCrush(audio, bits) {
  const levels = Math.pow(2, bits - 1);
  return mapChannels(audio, (x) => {
    const y = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) y[i] = Math.round(x[i] * levels) / levels;
    return y;
  });
}

// Two-pole (12 dB/oct) low-pass — the band-limiting half of lossy-codec damage.
// A 128kbps MP3 effectively discards content above roughly 15-16kHz.
export function lowPass(audio, cutoffHz) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoffHz) / audio.sampleRate);
  return mapChannels(audio, (x) => {
    const y = new Float32Array(x.length);
    let z1 = 0, z2 = 0;
    for (let i = 0; i < x.length; i++) {
      z1 += a * (x[i] - z1);
      z2 += a * (z1 - z2);
      y[i] = z2;
    }
    return y;
  });
}

// Additive white noise at a target SNR (dB) — a distortion the SilentCipher
// paper explicitly trains against.
export function addWhiteNoise(audio, snrDb) {
  return mapChannels(audio, (x) => {
    let sumSq = 0;
    for (let i = 0; i < x.length; i++) sumSq += x[i] * x[i];
    const rms = Math.sqrt(sumSq / x.length);
    const nAmp = rms / Math.pow(10, snrDb / 20);
    const y = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) y[i] = x[i] + (Math.random() * 2 - 1) * nAmp * Math.SQRT2;
    return y;
  });
}

// Crop a window out of the middle of the file.
export function crop(audio, seconds) {
  const want = Math.floor(seconds * audio.sampleRate);
  return mapChannels(audio, (x) => {
    const len = Math.min(want, x.length);
    const start = Math.floor((x.length - len) / 2);
    return x.slice(start, start + len);
  });
}

// Named attack registry. Keys are stable identifiers stored with results.
export const ATTACKS = {
  control: { label: 'Untouched file', apply: (a) => a },
  pitch_up_1: { label: 'Pitch shift +1 semitone (resample)', apply: (a) => pitchShiftResample(a, 1) },
  pitch_down_1: { label: 'Pitch shift -1 semitone (resample)', apply: (a) => pitchShiftResample(a, -1) },
  pitch_up_2: { label: 'Pitch shift +2 semitones (resample)', apply: (a) => pitchShiftResample(a, 2) },
  stretch_105: { label: 'Time stretch +5% (pitch preserved)', apply: (a) => timeStretchOLA(a, 1.05) },
  stretch_095: { label: 'Time stretch -5% (pitch preserved)', apply: (a) => timeStretchOLA(a, 0.95) },
  lowpass_15k: { label: 'Low-pass 15kHz (codec-style band-limiting)', apply: (a) => lowPass(a, 15000) },
  lowpass_11k: { label: 'Low-pass 11kHz (aggressive band-limiting)', apply: (a) => lowPass(a, 11000) },
  bitcrush_8: { label: 'Bit-depth crush to 8-bit', apply: (a) => bitCrush(a, 8) },
  noise_20db: { label: 'Additive white noise (20dB SNR)', apply: (a) => addWhiteNoise(a, 20) },
  noise_10db: { label: 'Additive white noise (10dB SNR)', apply: (a) => addWhiteNoise(a, 10) },
  crop_5s: { label: '5 second crop', apply: (a) => crop(a, 5) },
  crop_3s: { label: '3 second crop', apply: (a) => crop(a, 3) },
  crop_2s: { label: '2 second crop', apply: (a) => crop(a, 2) },
};

// Broadband, harmonically rich test signal. A bare sine pair is the WORST
// possible benchmark material — the SilentCipher paper flags band-limited audio
// as the hardest imperceptibility case, and a narrowband tone also gives a
// spread-spectrum detector an unrealistically clean correlation floor. This
// stacks harmonics, vibrato, an amplitude envelope and a light noise bed so the
// spectrum resembles real program material.
export function synthesizeBenchmarkSource(seconds = 12, sampleRate = 44100) {
  const frames = Math.floor(seconds * sampleRate);
  const x = new Float32Array(frames);
  const partials = [110, 220, 330, 440, 660, 880, 1320, 2200, 3300, 5500];
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * t);
    let s = 0;
    for (let p = 0; p < partials.length; p++) {
      s += (0.9 / (p + 1)) * Math.sin(2 * Math.PI * partials[p] * vib * t);
    }
    s += (Math.random() * 2 - 1) * 0.02;
    const env = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.75 * t);
    x[i] = s * env * 0.11;
  }
  return { sampleRate, channels: [x] };
}