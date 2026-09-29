// Shared chord helpers for the written-vs-played rolls. Comparison is at TRIAD level
// (root + major/minor): the recognizer only estimates triads, so comparing 7ths would
// report "drift" that is really a vocabulary gap.
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "Am7", "A:min7", "F#", "Bb/D" → { root, minor, label } or null */
export function parseChord(sym) {
  const m = String(sym || '').trim().match(/^([A-G])([#b]?)(.*)$/);
  if (!m) return null;
  const root = (BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? 11 : 0)) % 12;
  const rest = m[3].replace(/^:/, '').split('/')[0];
  const minor = /^(m(?!aj)|min|-|dim|hdim)/.test(rest);
  return { root, minor, label: m[1] + m[2] + m[3].replace(/^:/, '') };
}

export const triadName = (c) => (c ? NOTE_NAMES[c.root] + (c.minor ? 'm' : '') : '—');
export const sameTriad = (a, b) => !!a && !!b && a.root === b.root && a.minor === b.minor;
export const chordColor = (c) => (c ? `hsl(${c.root * 30} ${c.minor ? 55 : 75}% ${c.minor ? 42 : 55}%)` : 'hsl(24 10% 20%)');

/** Written chart → timed bar segments, looped to fill the bed's duration. */
export function chartToSegments(chart, { bpm = 120, timeSig = '4/4', duration = 30 }) {
  const beats = Number(String(timeSig).split('/')[0]) || 4;
  const barSec = (beats * 60) / (bpm || 120);
  const bars = String(chart || '').split(/[|\s]+/).filter(Boolean);
  if (!bars.length) return [];
  const out = [];
  for (let i = 0, t = 0; t < duration; i++, t += barSec) {
    const parts = bars[i % bars.length].split(',').filter(Boolean);
    parts.forEach((p, j) => {
      const start = t + (j * barSec) / parts.length;
      out.push({ start, end: Math.min(start + barSec / parts.length, duration), chord: parseChord(p), bar: i });
    });
  }
  return out;
}