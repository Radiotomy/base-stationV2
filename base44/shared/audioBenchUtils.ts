// Shared helpers for the BASE Mark / BASE Print measurement harnesses.
//
// Plain module, no handler. These live here rather than in each benchmark entry
// point because a benchmark is only comparable to another benchmark if both
// prepared their audio identically — a divergent copy of the trim or downmix step
// would silently make two runs measure different systems while still reporting
// the same field names.

// Downmix to mono. Both the Print extractor and the spectral detector work on a
// channel average, so this has to match what they expect.
export function toMono(audio) {
  const ch = audio.channels;
  if (ch.length === 1) return ch[0];
  const n = ch[0].length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < ch.length; c++) s += ch[c][i];
    out[i] = s / ch.length;
  }
  return out;
}

// Take the first N seconds. Used where the window just needs to be a bounded,
// repeatable slice of the file.
export function trimFromStart(audio, seconds) {
  if (!seconds) return audio;
  const want = Math.floor(seconds * audio.sampleRate);
  if (audio.channels[0].length <= want) return audio;
  return { sampleRate: audio.sampleRate, channels: audio.channels.map((c) => c.slice(0, want)) };
}

// Take N seconds from the MIDDLE. Deliberately distinct from trimFromStart: the
// head of a master is often an intro, fade-in or near-silence, which is the
// weakest possible evidence for a detector that needs broadband content. Anything
// measuring recovery rates should use this.
export function trimCentered(audio, seconds) {
  if (!seconds) return audio;
  const want = Math.floor(seconds * audio.sampleRate);
  if (audio.channels[0].length <= want) return audio;
  const start = Math.floor((audio.channels[0].length - want) / 2);
  return {
    sampleRate: audio.sampleRate,
    channels: audio.channels.map((c) => c.slice(start, start + want)),
  };
}

export function round(v, n = 4) {
  return Number(Number(v).toFixed(n));
}