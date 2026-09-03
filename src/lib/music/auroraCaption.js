/**
 * Aurora (MiniMax-Music3) Structured Caption compiler.
 *
 * MiniMax Music 3 reads ONE text field for style, but the model card is explicit
 * that it was trained to follow a three-block "Structured Caption" — Global
 * Metadata, Vocal Details, Arrangement — and that this representation is what
 * lets the model follow the song's development over time rather than just a
 * global vibe. So the studio collects the blocks as real fields and compiles
 * them here into exactly the layout the reference script uses.
 *
 * Prose mode stays supported: a creator who writes a paragraph gets it passed
 * through untouched, because a paragraph forced into headed blocks would read as
 * three fragments and lose the sentence flow the text encoder is reading.
 */

export const SECTION_TAGS = [
  '[Intro]', '[Verse]', '[Pre-Chorus]', '[Chorus]', '[Post-Chorus]',
  '[Bridge]', '[Instrumental]', '[Solo]', '[Outro]',
];

export const EMPTY_CAPTION = {
  // Global Metadata
  genre: '', subgenre: '', bpm: '', key: '', scale: '',
  emotional_progression: '', scenario: '', production: '',
  // Vocal Details
  vocal_gender: '', vocal_timbre: '', vocal_style: '',
  harmony: '', vocal_fx: '',
  // Arrangement
  primary_instruments: '', secondary_instruments: '', instrument_evolution: '',
  groove: '', bass: '', percussion: '', textures: '', spatial_fx: '',
};

const line = (label, value) => (value && value.trim() ? `${label}: ${value.trim()}\n` : '');

/**
 * Compile the field set into MiniMax's Structured Caption. Empty fields are
 * omitted rather than emitted with placeholder text: a caption saying
 * "Vocal FX: none specified" is an instruction, and the model would follow it.
 */
export function compileStructuredCaption(c) {
  const basics = [
    c.bpm && `bpm is ${String(c.bpm).trim()}`,
    c.key && `key is ${c.key.trim()}`,
    c.scale && `scale is ${c.scale.trim()}`,
  ].filter(Boolean).join('. ');
  const style = [c.genre, c.subgenre].filter((s) => s && s.trim()).join(' / ');

  let out = '';
  const global = line('Basic Attributes', [basics, style].filter(Boolean).join('. '))
    + line('Global Emotional Progression', c.emotional_progression)
    + line('Application Scenarios & Imagery', c.scenario)
    + line('Sonics & Production Profile', c.production);
  if (global) out += `Global Metadata\n${global}`;

  const vocal = line('Vocal Gender & Timbre', [c.vocal_gender, c.vocal_timbre].filter((s) => s && s.trim()).join('. '))
    + line('Vocal Style', c.vocal_style)
    + line('Harmony/Backing Vocals', c.harmony)
    + line('Vocal FX', c.vocal_fx);
  if (vocal) out += `Vocal Details\n${vocal}`;

  const arrangement = line('Primary', c.primary_instruments)
    + line('Secondary', c.secondary_instruments)
    + line('Instrument Lifecycle Description', c.instrument_evolution)
    + line('Groove & Foundation Progression', [c.groove, c.percussion, c.bass].filter((s) => s && s.trim()).join('. '))
    + line('Embellishments, Textures & Spatial FX', [c.textures, c.spatial_fx].filter((s) => s && s.trim()).join('. '));
  if (arrangement) out += `Arrangement\n${arrangement}`;

  return out.trim();
}

/** True when the creator has given the compiler nothing to work with. */
export function isCaptionEmpty(c) {
  return !compileStructuredCaption(c);
}

/**
 * Resolve whichever authoring mode the creator is in into the single prompt the
 * engine receives. Kept here so the studio tab and any future caller agree on
 * what "the prompt" means for an Aurora render.
 */
export function resolveAuroraPrompt({ mode, prose, caption }) {
  return mode === 'prose' ? (prose || '').trim() : compileStructuredCaption(caption);
}