// Bassline + Tonematrix generators. Both are fixed 16-step grids, so a prompt
// becomes a native device pattern that stays editable inside Audiotool.
import { base44 } from '@/api/base44Client';
import { createPatternDevice } from '@/lib/audiotool/patternDevice';

export const STEPS = 16;
export const BASS_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', "C'"];
// Tonematrix pitches, lowest first (pentatonic from C4). Nexus stores them top-down.
export const TONE_NOTES = Array.from({ length: 16 }, (_, i) => `${['C', 'D', 'F', 'G', 'A'][i % 5]}${4 + Math.floor(i / 5)}`);

const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));
const blankBassStep = () => ({ note: null, octave: 0, slide: false, accent: false });

export const emptySynth = (kind) => (kind === 'bassline'
  ? { kind, name: 'My Bassline', steps: Array.from({ length: STEPS }, blankBassStep) }
  : { kind, name: 'My Tonematrix', grid: Array.from({ length: STEPS }, () => Array(16).fill(false)) });

export async function planSynth(kind, prompt) {
  if (kind === 'bassline') {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You program a TB-303 style acid bassline (Audiotool Bassline), 16 steps of 16th notes, for: "${prompt}".
Return exactly 16 steps. Each step: "note" = semitones above C (0-12) or null for a rest, "octave" -1, 0 or 1, "slide" (glide from previous note), "accent". Also a short "name" (max 4 words).`,
      response_json_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          steps: { type: 'array', items: { type: 'object', properties: {
            note: { type: ['integer', 'null'] }, octave: { type: 'integer' }, slide: { type: 'boolean' }, accent: { type: 'boolean' },
          } } },
        },
        required: ['steps'],
      },
    });
    return {
      kind, name: res.name || 'AI Bassline',
      steps: Array.from({ length: STEPS }, (_, i) => {
        const s = res.steps?.[i];
        if (!s || s.note === null || s.note === undefined) return blankBassStep();
        return { note: clampInt(s.note, 0, 12), octave: clampInt(s.octave, -1, 1), slide: !!s.slide, accent: !!s.accent };
      }),
    };
  }
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You program an Audiotool Tonematrix: a 16x16 grid, 16 steps of 16th notes, 16 pentatonic pitches (${TONE_NOTES.join(', ')}). Write a pattern for: "${prompt}".
Return "steps": exactly 16 arrays (one per step), each listing the pitch indexes 0-15 that play (0 = C4, lowest). Keep it musical and sparse (0-3 notes per step). Also a short "name" (max 4 words).`,
    response_json_schema: {
      type: 'object',
      properties: { name: { type: 'string' }, steps: { type: 'array', items: { type: 'array', items: { type: 'integer' } } } },
      required: ['steps'],
    },
  });
  return {
    kind, name: res.name || 'AI Tonematrix',
    grid: Array.from({ length: STEPS }, (_, i) => {
      const on = new Set((res.steps?.[i] || []).map((p) => clampInt(p, 0, 15)));
      return Array.from({ length: 16 }, (_, p) => on.has(p));
    }),
  };
}

/** Creates the device + mixer channel and writes the pattern. Returns the device id. */
export function buildSynth(nexus, synth) {
  return nexus.modify((t) => {
    if (synth.kind === 'bassline') {
      const { device, steps } = createPatternDevice(t, { type: 'bassline', patternType: 'basslinePattern', name: synth.name, pattern: { length: STEPS } });
      synth.steps.forEach((s, i) => {
        const f = steps[i].fields;
        // Bassline steps default to ACTIVE — rests must be switched off explicitly.
        if (s.note === null) return t.update(f.isActive, false);
        t.update(f.key, 36 + s.note);
        if (s.octave) t.update(f.transposeOctaves, s.octave);
        if (s.slide) t.update(f.doesSlide, true);
        if (s.accent) t.update(f.isAccented, true);
      });
      return device.id;
    }
    const { device, steps } = createPatternDevice(t, { type: 'tonematrix', patternType: 'tonematrixPattern', name: synth.name });
    synth.grid.forEach((col, i) => col.forEach((on, p) => { if (on) t.update(steps[i].fields.notes.array[15 - p], true); }));
    return device.id;
  });
}