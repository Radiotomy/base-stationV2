// BASE SoundForge — loop finishing stage.
//
// Raw generative audio is never loop-ready: it starts with a few ms of encoder
// silence, ends at an arbitrary point mid-waveform, and sits at whatever level
// the model felt like. Dropped into a DAW that produces a click at every loop
// boundary, a late first transient, and levels that don't match the rest of the
// session. This module fixes all three before the file is ever uploaded.
//
// Pure DSP on PCM WAV — no GPU, no external call, sub-second on an 8s loop.
// Everything here is non-destructive in spirit: it only trims, folds and scales,
// never resamples or re-encodes, so the audio stays bit-clean for BASE Mark.

import { parseWav } from './baseMark.ts';
import { encodeWav } from './wavEncode.ts';
import { detectFormat } from './mp3Decode.ts';

const SILENCE_THRESHOLD = 0.0015;   // ~-56 dBFS — below this is encoder noise floor
const FOLD_MS = 30;                 // tail folded back over the head
const EDGE_FADE_MS = 3;             // click guard on one-shot edges
const TARGET_PEAK = 0.891;          // -1 dBFS, standard sample-library headroom
const BEAT_CANDIDATES = [1, 2, 4, 8, 16, 32, 64];

// Categories that loop (get bar-locking + tail fold) vs. categories that are
// one-shots (get tight edge trimming + fades instead — folding a one-shot's tail
// over its own transient would smear the attack, which is the whole point of it).
const LOOPING = new Set(['loop', 'drum_loop', 'bass_loop', 'melodic_loop']);

function readSample(dv, off, bps) {
  if (bps === 2) return dv.getInt16(off, true) / 32768;
  let v = dv.getUint8(off) | (dv.getUint8(off + 1) << 8) | (dv.getUint8(off + 2) << 16);
  if (v & 0x800000) v -= 0x1000000;
  return v / 8388608;
}

function decode(bytes, wav) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const bps = wav.bitsPerSample / 8;
  const ch = wav.channels;
  const frames = Math.floor(wav.dataLen / (bps * ch));
  const chans = [];
  for (let c = 0; c < ch; c++) chans.push(new Float32Array(frames));
  for (let n = 0; n < frames; n++) {
    for (let c = 0; c < ch; c++) {
      chans[c][n] = readSample(dv, wav.dataOffset + (n * ch + c) * bps, bps);
    }
  }
  return chans;
}

function peakOf(chans, from, to) {
  let peak = 0;
  for (const c of chans) {
    for (let n = from; n < to; n++) {
      const a = Math.abs(c[n]);
      if (a > peak) peak = a;
    }
  }
  return peak;
}

function firstAudible(chans) {
  const frames = chans[0].length;
  for (let n = 0; n < frames; n++) {
    for (const c of chans) if (Math.abs(c[n]) > SILENCE_THRESHOLD) return n;
  }
  return 0;
}

function lastAudible(chans) {
  const frames = chans[0].length;
  for (let n = frames - 1; n >= 0; n--) {
    for (const c of chans) if (Math.abs(c[n]) > SILENCE_THRESHOLD) return n;
  }
  return frames - 1;
}

// Step back to the nearest upward zero crossing so the cut never lands
// mid-waveform (a mid-waveform cut is a step discontinuity = an audible click).
function zeroCrossBefore(chans, idx, limit = 2000) {
  const ref = chans[0];
  for (let n = idx; n > Math.max(0, idx - limit); n--) {
    if (ref[n - 1] <= 0 && ref[n] > 0) return n;
  }
  return idx;
}

function slice(chans, from, to) {
  return chans.map((c) => c.slice(from, to));
}

/**
 * Polish a generated WAV into a DAW-ready loop or one-shot.
 * Never throws — on anything unexpected it returns the original bytes with a
 * reason, so a finishing problem can never fail a paid generation.
 */
export function polishLoop(bytes, { bpm, category = 'loop' } = {}) {
  try {
    const wav = parseWav(bytes);
    if (!wav || wav.audioFormat !== 1 || (wav.bitsPerSample !== 16 && wav.bitsPerSample !== 24)) {
      return { bytes, info: null, skipped: 'Not a 16/24-bit PCM WAV' };
    }

    const sr = wav.sampleRate;
    const bps = wav.bitsPerSample / 8;
    let chans = decode(bytes, wav);
    if (!chans[0]?.length) return { bytes, info: null, skipped: 'No audio frames' };

    const isLoop = LOOPING.has(category);
    const originalFrames = chans[0].length;

    // 1) Trim the dead air the model leaves at the head, landing on a zero
    //    crossing so the very first sample is silent-to-signal, not a step.
    const start = zeroCrossBefore(chans, firstAudible(chans));
    const end = isLoop ? chans[0].length : Math.min(chans[0].length, lastAudible(chans) + Math.round(sr * 0.005));
    if (end - start < sr * 0.1) return { bytes, info: null, skipped: 'Too short after trimming' };
    chans = slice(chans, start, end);

    let bars = null;
    let beats = null;
    let folded = false;

    if (isLoop) {
      const foldLen = Math.min(Math.round((FOLD_MS / 1000) * sr), Math.floor(chans[0].length / 8));

      // 2) Lock the length to a whole number of beats so the loop lines up with
      //    the session grid instead of drifting a few ms per repeat. Only ever
      //    cuts down to the largest musical length that fits (padding with
      //    silence would put a gap in the groove).
      if (bpm && bpm > 0) {
        const framesPerBeat = (60 / bpm) * sr;
        const usable = chans[0].length - foldLen; // the fold consumes the tail
        let chosen = null;
        for (const b of BEAT_CANDIDATES) {
          const need = Math.round(framesPerBeat * b);
          if (need <= usable) chosen = { b, need };
        }
        if (chosen) {
          chans = slice(chans, 0, chosen.need + foldLen);
          beats = chosen.b;
          bars = +(chosen.b / 4).toFixed(2);
        }
      }

      // 3) The seamless join. Fold the tail back over the head with an
      //    equal-power crossfade and drop it: what used to be the abrupt end now
      //    lives underneath the start, so the wrap point is continuous audio
      //    rather than a splice. Equal-power (sqrt) rather than linear keeps
      //    perceived loudness flat across the join.
      if (foldLen > 32) {
        const L = chans[0].length;
        for (const c of chans) {
          for (let i = 0; i < foldLen; i++) {
            const t = i / foldLen;
            c[i] = c[i] * Math.sqrt(t) + c[L - foldLen + i] * Math.sqrt(1 - t);
          }
        }
        chans = slice(chans, 0, L - foldLen);
        folded = true;
      }
    } else {
      // One-shots: micro-fades on both edges kill the click without touching
      // the transient, which sits well inside the fade window.
      const f = Math.min(Math.round((EDGE_FADE_MS / 1000) * sr), Math.floor(chans[0].length / 4));
      for (const c of chans) {
        for (let i = 0; i < f; i++) {
          c[i] *= i / f;
          c[c.length - 1 - i] *= i / f;
        }
      }
    }

    // 4) Normalize to -1 dBFS. Sample libraries are expected to sit at a
    //    consistent level with a little headroom; whatever the model returned is
    //    arbitrary, and quiet samples make users reach for gain before they can
    //    even audition.
    const peak = peakOf(chans, 0, chans[0].length);
    let gain = 1;
    if (peak > 0.0001) {
      gain = TARGET_PEAK / peak;
      for (const c of chans) for (let n = 0; n < c.length; n++) c[n] *= gain;
    }

    const frames = chans[0].length;
    return {
      bytes: encodeWav(chans, sr, bps),
      info: {
        seamless: folded,
        bars,
        beats,
        bpm: bpm || null,
        duration_seconds: +(frames / sr).toFixed(3),
        sample_rate: sr,
        bit_depth: wav.bitsPerSample,
        channels: chans.length,
        trimmed_frames: originalFrames - frames,
        gain_db: +(20 * Math.log10(gain)).toFixed(2),
        peak_dbfs: -1,
      },
      skipped: null,
    };
  } catch (e) {
    return { bytes, info: null, skipped: e.message };
  }
}

/**
 * Fetch a generated audio URL, polish it, and upload the finished file.
 * Shared by the synchronous generation path and the webhook/poll finalize path
 * so a loop gets identical treatment however it completes.
 */
export async function fetchPolishUpload(base44, url, baseName, opts = {}) {
  const r = await fetch(url);
  const raw = new Uint8Array(await r.arrayBuffer());

  // Only PCM WAV can be polished. An MP3 provider payload is stored as-is and
  // labelled as MP3 — silently renaming a lossy file to .wav would misrepresent
  // it to both the user's DAW and the BASE Mark chain.
  const format = detectFormat(raw);
  const { bytes, info, skipped } =
    format === 'wav'
      ? polishLoop(raw, opts)
      : { bytes: raw, info: null, skipped: `Provider returned ${format} — finishing stage needs PCM WAV` };

  const ext = format === 'wav' ? 'wav' : 'mp3';
  const mime = format === 'wav' ? 'audio/wav' : 'audio/mpeg';
  const safeName = (baseName || 'soundforge').replace(/[^\w.\-]/g, '_').slice(0, 60) || 'soundforge';
  const file = new File([bytes], `${safeName}.${ext}`, { type: mime });
  const up = await base44.integrations.Core.UploadFile({ file });
  return {
    file_url: up.file_url,
    info: info ? { ...info, source_format: format } : info,
    skipped,
  };
}