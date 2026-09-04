/**
 * Translate a 243 Masters brief into Aurora's conditioning dialect.
 *
 * Aurora (MiniMax-Music3) is the only one of our engines whose style channel is
 * not a single string: the model card is explicit that it follows a three-block
 * Structured Caption, and that this is what lets it develop the song over time.
 * So the Masters brief is mapped into the SAME caption FIELDS the studio's
 * builder edits — not into a flat prompt — which keeps the compiled caption and
 * the visible form in agreement and leaves every field the creator's to revise.
 */

import { compileStructuredCaption } from '@/lib/music/auroraCaption';

// Instrumentation beds written as caption values, i.e. plain noun phrases. The
// caption's own headings supply the grammar, so a full sentence here would read
// as a sentence inside a field label.
const AURORA_BEDS = {
  pop: { primary: 'punchy acoustic drum kit, driving electric bass, bright layered synths', secondary: 'piano, clean electric guitar, synth pads' },
  'hip-hop': { primary: 'hard drum break, 808 sub bass, trap hi-hats', secondary: 'sampled keys, vinyl texture, low brass' },
  'r&b': { primary: 'fatback drums, warm electric bass, Rhodes electric piano', secondary: 'muted guitar, string pad, finger snaps' },
  country: { primary: 'brushed drums, upright bass, acoustic guitar', secondary: 'pedal steel, fiddle, mandolin' },
  rock: { primary: 'live drum kit, distorted rhythm guitar, driving bass', secondary: 'lead guitar, organ' },
  edm: { primary: 'four-on-the-floor kick, sidechained bass, saw synth lead', secondary: 'white-noise risers, plucked arp, reverb pad' },
  'lo-fi': { primary: 'dusty drum loop, upright bass, mellow electric piano', secondary: 'vinyl crackle, muted trumpet, tape hiss' },
  soul: { primary: 'vintage drum kit, electric bass, Hammond organ', secondary: 'horn section, tambourine, clean guitar' },
  folk: { primary: 'fingerpicked acoustic guitar, upright bass', secondary: 'soft shaker, accordion, close harmony' },
  afrobeats: { primary: 'afrobeats percussion pocket, log-drum bass, shaker', secondary: 'plucked guitar, marimba, airy synth pad' },
};

/**
 * Build Aurora caption fields from a Masters brief. Returns ONLY the fields the
 * brief actually speaks to — an empty value is dropped rather than returned, so
 * merging a brief into a part-filled caption cannot erase vocal or texture
 * details the creator already wrote. (An invented field would be worse still: a
 * caption line is an instruction the model follows.)
 */
export function toAuroraCaptionFields(brief = {}, { genre, mood } = {}) {
  const key = String(genre || '').toLowerCase();
  const bed = AURORA_BEDS[key] || {};
  const fields = {
    genre: genre || '',
    bpm: brief.bpm ? String(brief.bpm) : '',
    key: brief.key || '',
    emotional_progression: mood
      ? `Opens ${String(mood).toLowerCase()} and builds through the choruses before resolving.`
      : '',
    production: brief.production_brief || '',
    primary_instruments: bed.primary || '',
    secondary_instruments: bed.secondary || '',
    groove: brief.bpm ? `Steady ${genre ? String(genre).toLowerCase() + ' ' : ''}groove at ${brief.bpm} BPM.` : '',
  };
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v && String(v).trim()));
}

/** Compiled caption text — used only to preview what the engine will receive. */
export function toAuroraCaptionText(brief, opts) {
  return compileStructuredCaption(toAuroraCaptionFields(brief, opts));
}