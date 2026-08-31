/**
 * Lead-sheet score parsing.
 *
 * The melody is authored as plain text, one note per line: a syllable, a
 * scientific pitch, and a length in beats.
 *
 *     Twin  C4  1
 *     kle   C4  1
 *     lit   G4  1
 *     -     G4  0.5      <- '-' holds the previous syllable (a melisma)
 *
 * Text rather than a piano roll on purpose: it is diff-able, paste-able, and it
 * is what gets hashed as the provenance artifact. A note grid would have to be
 * serialized into something like this anyway before it could be attested to.
 */

const NOTE_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C4' -> 60, 'F#3' -> 54. Returns null for anything unparseable. */
export function noteToMidi(name) {
  const m = /^([A-Ga-g])([#b]?)(-?\d{1,2})$/.exec((name || '').trim());
  if (!m) return null;
  const base = NOTE_SEMITONES[m[1].toUpperCase()];
  if (base === undefined) return null;
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const octave = parseInt(m[3], 10);
  const midi = base + accidental + (octave + 1) * 12;
  return midi >= 0 && midi <= 127 ? midi : null;
}

export function midiToNote(midi) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/** '1', '0.5', '1/4' and '3/8' are all accepted lengths. */
function parseBeats(raw) {
  const text = (raw || '').trim();
  if (text.includes('/')) {
    const [a, b] = text.split('/');
    const num = parseFloat(a);
    const den = parseFloat(b);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    return num / den;
  }
  const n = parseFloat(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse the melody text into the note list the engine renders.
 *
 * Returns { notes, errors }. Errors are per-line and never throw: a writer with
 * one typo on line 40 should still see the other 39 notes parsed, because losing
 * the whole score to a single mistake is how people stop trusting the editor.
 */
export function parseMelody(text) {
  const notes = [];
  const errors = [];
  const lines = (text || '').split('\n');

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) {
      errors.push({ line: i + 1, message: 'Needs three parts: syllable, note, beats' });
      return;
    }

    const [syllable, noteName, beatsRaw] = parts;
    const midi = noteToMidi(noteName);
    if (midi === null) {
      errors.push({ line: i + 1, message: `"${noteName}" is not a pitch like C4 or F#3` });
      return;
    }
    const beats = parseBeats(beatsRaw);
    if (beats === null || beats <= 0) {
      errors.push({ line: i + 1, message: `"${beatsRaw}" is not a length like 1, 0.5 or 1/4` });
      return;
    }

    notes.push({ syllable, note: midiToNote(midi), midi, beats });
  });

  return { notes, errors };
}

/** Total length in seconds at a given tempo — what the studio shows as duration. */
export function scoreSeconds(notes, bpm) {
  if (!bpm || bpm <= 0) return 0;
  const beats = (notes || []).reduce((sum, n) => sum + (n.beats || 0), 0);
  return (beats / bpm) * 60;
}