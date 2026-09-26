// Drum Machine generator: prompt → step pattern → a Beatbox 8 created live in
// the session with the pattern written into its first pattern slot, wired to a
// fresh mixer channel. The pattern is Beatbox 8 native, so it stays editable
// on the device's own step sequencer.
import { base44 } from '@/api/base44Client';
import { createPatternDevice } from '@/lib/audiotool/patternDevice';

export const DRUM_VOICES = [
  ['bassdrum', 'Kick'], ['snaredrum', 'Snare'], ['clapMaracas', 'Clap'], ['rimClaves', 'Rim'],
  ['closedHihat', 'Closed hat'], ['openHihat', 'Open hat'], ['cymbal', 'Cymbal'], ['cowbell', 'Cowbell'],
  ['tomCongaLow', 'Low tom'], ['tomCongaMid', 'Mid tom'], ['tomCongaHigh', 'High tom'],
];

const toSteps = (s, n) => Array.from({ length: n }, (_, i) => /[xX1*]/.test(s?.[i] || ''));

export async function planDrums(prompt, steps) {
  const rows = Object.fromEntries(DRUM_VOICES.map(([v]) => [v, { type: 'string' }]));
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You program a TR-808 style drum machine (Audiotool Beatbox 8). Write a ${steps}-step pattern of 16th notes (4 steps = one beat) for: "${prompt}".
For every voice return a string of exactly ${steps} characters: "x" = hit, "." = rest. Leave voices that shouldn't play as all dots.
Voices: ${DRUM_VOICES.map(([v, l]) => `${v} (${l})`).join(', ')}. Also give "accents" in the same format and a short "name" (max 4 words).`,
    response_json_schema: {
      type: 'object',
      properties: { name: { type: 'string' }, accents: { type: 'string' }, rows: { type: 'object', properties: rows } },
      required: ['name', 'rows'],
    },
  });
  return {
    name: res.name || 'AI Beat',
    steps,
    accents: toSteps(res.accents, steps),
    rows: Object.fromEntries(DRUM_VOICES.map(([v]) => [v, toSteps(res.rows?.[v], steps)])),
  };
}

export const emptyPattern = (steps) => ({
  name: 'My Beat', steps, accents: toSteps('', steps),
  rows: Object.fromEntries(DRUM_VOICES.map(([v]) => [v, toSteps('', steps)])),
});

/** Creates the Beatbox 8 + mixer channel and writes the pattern. Returns the device id. */
export function buildDrums(nexus, pattern) {
  return nexus.modify((t) => {
    const { device: box, steps } = createPatternDevice(t, {
      type: 'beatbox8', patternType: 'beatbox8Pattern', name: pattern.name,
      pattern: { length: pattern.steps, stepScaleIndex: 3 },
    });
    for (let i = 0; i < pattern.steps; i++) {
      const step = steps[i].fields;
      if (pattern.accents[i]) t.update(step.isAccented, true);
      DRUM_VOICES.forEach(([v]) => { if (pattern.rows[v][i]) t.update(step[`${v}IsActive`], true); });
    }
    return box.id;
  });
}