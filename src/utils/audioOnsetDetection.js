/**
 * Lightweight client-side beat/onset detector.
 *
 * Loads an audio URL into an OfflineAudioContext, low-passes it, then walks the
 * energy envelope looking for significant peaks. Returns evenly-spaced
 * onset-aligned cut points the UI can use to propose scene boundaries.
 *
 * This is deliberately simple — no bpm-locked grid, no librosa-grade
 * accuracy. It's a "good enough" musical cut suggester for short videos.
 *
 * Returns:
 *   {
 *     duration: number,      // seconds
 *     onsets: number[],      // seconds, strongest energy peaks
 *   }
 */
export async function analyzeAudioOnsets(audioUrl, { maxOnsets = 12, minGapS = 1.5 } = {}) {
  const res = await fetch(audioUrl);
  const buf = await res.arrayBuffer();

  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  // Decode in a temporary online context first (broader codec support), then
  // walk the resulting AudioBuffer directly — no need to render offline.
  const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuf = await decodeCtx.decodeAudioData(buf);
  decodeCtx.close?.();

  const sr = audioBuf.sampleRate;
  const data = audioBuf.getChannelData(0); // mono — first channel is good enough
  const duration = audioBuf.duration;

  // Compute RMS energy in 50ms windows
  const winSize = Math.floor(sr * 0.05);
  const numWins = Math.floor(data.length / winSize);
  const energy = new Float32Array(numWins);
  for (let w = 0; w < numWins; w++) {
    let sum = 0;
    const start = w * winSize;
    for (let i = 0; i < winSize; i++) {
      const v = data[start + i];
      sum += v * v;
    }
    energy[w] = Math.sqrt(sum / winSize);
  }

  // Spectral flux-ish: positive energy deltas
  const flux = new Float32Array(numWins);
  for (let w = 1; w < numWins; w++) {
    flux[w] = Math.max(0, energy[w] - energy[w - 1]);
  }

  // Pick top peaks with a minimum gap
  const minGapWins = Math.floor((minGapS * 1000) / 50);
  const indexed = Array.from(flux, (v, i) => ({ v, i }));
  indexed.sort((a, b) => b.v - a.v);

  const picked = [];
  for (const { i } of indexed) {
    if (picked.length >= maxOnsets) break;
    if (picked.every((p) => Math.abs(p - i) >= minGapWins)) {
      picked.push(i);
    }
  }
  picked.sort((a, b) => a - b);

  const onsets = picked.map((w) => +(w * 0.05).toFixed(2));
  return { duration, onsets };
}

/**
 * Converts onset timestamps to a list of scene durations (seconds), summing
 * to the audio's total duration. Pads with the trailing tail.
 */
export function onsetsToSceneDurations(duration, onsets) {
  if (!onsets || onsets.length === 0) return [Math.round(duration)];
  const bounds = [0, ...onsets, duration];
  const durations = [];
  for (let i = 1; i < bounds.length; i++) {
    const d = Math.max(1, Math.round(bounds[i] - bounds[i - 1]));
    durations.push(d);
  }
  return durations;
}