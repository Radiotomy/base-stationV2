// Per-model conditioning dialects for BASE Station's own self-hosted engines.
//
// All three of our open-source models take a "style" input and a "lyrics" input,
// and all three read them DIFFERENTLY. One shared formatter would silently
// degrade two of the three, so each model gets its own converter and the 243
// Masters brief is translated into whichever dialect the target engine speaks.
//
//   Coda / BASE-Harmonix (ACE-Step 1.5 XL Turbo)
//     style  : dense COMMA-separated sonic tokens (512-char cap)
//     lyrics : LOWERCASE structure tags — [verse], [chorus]
//     → lives in utils/aceStepLyrics.js (already shipped, unchanged)
//
//   Siren Song (HeartMuLa 3B)
//     style  : comma-separated TAG TOKENS, not a sentence
//     lyrics : Title-Case bracketed sections — [Verse], [Chorus]
//
//   Skye (DiffRhythm 2)
//     style  : PROSE — a natural-language sentence for the text encoder
//     lyrics : plain sections, optionally LRC-timestamped ("[00:12.50] line")
//
// Shared rule across every dialect: annotations a human songwriter writes for
// other humans ("Verse 2 (half-time, whispered)") must never survive into the
// lyric channel, because every one of these models will sing them out loud.

// Coda's converters already live in aceStepLyrics.js and are re-exported into the
// dialect registry below rather than reimplemented, so the Harmonix tab and the
// shared assistant cannot drift apart on what ACE-Step actually accepts.
import { toHarmonixPrompt, toAceStepLyrics } from '@/utils/aceStepLyrics';
// Aurora's style channel is a structured caption, not a string, so its converter
// lives beside the caption compiler it has to stay compatible with.
import { toAuroraCaptionFields, toAuroraCaptionText } from '@/lib/music/auroraMastersBrief';

// ── shared section cleaning ─────────────────────────────────────────────────

const CANON = ['intro', 'verse', 'pre-chorus', 'chorus', 'hook', 'bridge', 'breakdown', 'instrumental', 'outro'];

const ALIASES = {
  refrain: 'chorus', 'post-chorus': 'chorus', prechorus: 'pre-chorus',
  'pre chorus': 'pre-chorus', drop: 'breakdown', solo: 'instrumental',
  interlude: 'instrumental', rap: 'verse', 'verse/rap': 'verse',
  tag: 'outro', coda: 'outro', adlib: 'hook', 'ad-lib': 'hook',
};

// True for an LRC timestamp like [00:12.50] — these are DATA, not section
// headers, and Skye aligns phonetically against them, so they pass through
// completely untouched.
const isTimestamp = (s) => /^\d{1,2}:\d{2}(\.\d{1,3})?$/.test(s.trim());

function canonSection(raw) {
  let t = raw.toLowerCase().replace(/\(.*?\)/g, '').replace(/[—–-]\s*.*$/, '').trim();
  t = t.replace(/\s*\d+\s*$/, '').trim();
  if (CANON.includes(t)) return t;
  if (ALIASES[t]) return ALIASES[t];
  return CANON.find((s) => t.includes(s)) || 'verse';
}

const titleCase = (s) => s.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('-');

/**
 * Rewrite bracketed section headers through `fmt`, leaving LRC timestamps and
 * sung lines alone. Shared by the Siren Song and Skye converters, which differ
 * only in how they capitalize a section name.
 */
function rewriteSections(lyrics, fmt) {
  const lines = String(lyrics || '').split('\n');
  const out = [];
  let sawSection = false;

  for (const line of lines) {
    const m = line.trim().match(/^\[([^\]]+)\]$/);
    if (m && !isTimestamp(m[1])) {
      sawSection = true;
      const tag = fmt(canonSection(m[1]));
      if (out[out.length - 1] !== tag) {
        if (out.length) out.push('');
        out.push(tag);
      }
    } else {
      out.push(line.trimEnd());
    }
  }
  if (!sawSection) return `${fmt('verse')}\n${String(lyrics || '').trim()}`;
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ── Siren Song (HeartMuLa 3B) ───────────────────────────────────────────────

// Tag vocabulary per genre. HeartMuLa conditions on tokens, so naming the
// rhythm section and vocal type as tags is what actually steers the arrangement
// — a prose sentence here is mostly wasted on this model's tag encoder.
const SIREN_TAG_BEDS = {
  pop: 'pop,punchy drums,bright synth,driving bass,polished',
  'hip-hop': 'hip hop,808 bass,hard drum break,trap hats',
  'r&b': 'rnb,smooth,rhodes,fatback drums,electric bass,slow jam',
  country: 'country,acoustic guitar,pedal steel,brushed drums,upright bass',
  rock: 'rock,distorted guitar,live drums,driving bass',
  edm: 'edm,four on the floor,sidechain bass,synth lead',
  'lo-fi': 'lofi,dusty drums,mellow keys,vinyl crackle',
  soul: 'soul,hammond organ,horn section,vintage,tambourine',
  folk: 'folk,fingerpicked acoustic,soft percussion,intimate',
  afrobeats: 'afrobeats,log drum,percussion,rolling groove',
};

/**
 * Build Siren Song's tag string from a Masters brief. Comma tokens only — the
 * production paragraph is reduced to its keywords rather than pasted in, since a
 * sentence dilutes every tag it sits beside.
 */
export function toSirenSongTags(brief = {}, { genre, mood } = {}) {
  const bed = SIREN_TAG_BEDS[String(genre || '').toLowerCase()] || '';
  const keywords = String(brief.production_brief || '')
    .toLowerCase()
    .split(/[,.;]/)
    .map((s) => s.trim())
    .filter((s) => s && s.split(' ').length <= 3)
    .slice(0, 6);

  const parts = [
    String(genre || '').toLowerCase(),
    String(mood || '').toLowerCase(),
    bed,
    ...keywords,
    brief.bpm ? `${brief.bpm} bpm` : '',
  ].filter(Boolean);

  // De-duplicate: a token repeated across the bed and the brief double-weights
  // it against everything else the creator asked for.
  const seen = new Set();
  const tokens = parts.join(',').split(',')
    .map((t) => t.trim())
    .filter((t) => t && !seen.has(t) && seen.add(t));

  return tokens.join(',').slice(0, 400);
}

/** Title-Case bracketed sections — the form HeartMuLa was trained on. */
export function toSirenSongLyrics(lyrics = '') {
  return rewriteSections(lyrics, (s) => `[${titleCase(s)}]`);
}

// ── Skye (DiffRhythm 2) ─────────────────────────────────────────────────────

// Prose beds. DiffRhythm 2 reads a text encoder, so full clauses land where
// bare tokens would not — this is the exact inverse of the Siren Song bed.
const SKYE_PROSE_BEDS = {
  pop: 'a punchy sustained drum groove, driving bass and bright layered synths, produced cleanly and loud',
  'hip-hop': 'a hard looped drum break under steady 808 sub bass, with the groove never dropping out',
  'r&b': 'a locked fatback pocket with tight snare, persistent electric bass and warm Rhodes electric piano',
  country: 'brushed drums with upright and electric bass, acoustic guitar and pedal steel sitting warm in the mix',
  rock: 'a driving live drum groove beneath distorted rhythm guitar and steady bass',
  edm: 'a four-on-the-floor kick with sidechained bass and continuous rhythmic energy',
  'lo-fi': 'a dusty laid-back drum loop with mellow keys and gentle vinyl noise',
  soul: 'a vintage soul rhythm section with Hammond organ, horn section and steady tambourine',
  folk: 'gently fingerpicked acoustic guitar with soft understated percussion',
  afrobeats: 'a rolling afrobeats percussion pocket over steady log-drum bass',
};

/**
 * Build Skye's style prompt as PROSE. Written as one flowing sentence because
 * comma-token dumps measurably underperform on DiffRhythm 2's text encoder.
 */
export function toSkyeStylePrompt(brief = {}, { genre, mood } = {}) {
  const bed = SKYE_PROSE_BEDS[String(genre || '').toLowerCase()] || '';
  const lead = [mood ? String(mood).toLowerCase() : '', String(genre || '').toLowerCase()]
    .filter(Boolean).join(' ');

  const clauses = [
    lead ? `A ${lead} track` : 'A track',
    bed ? `featuring ${bed}` : '',
    brief.bpm ? `at around ${brief.bpm} BPM` : '',
    brief.key ? `in the key of ${brief.key}` : '',
    brief.production_brief ? String(brief.production_brief).trim().replace(/\.$/, '') : '',
  ].filter(Boolean);

  return `${clauses.join(', ')}.`.replace(/\s+/g, ' ').slice(0, 600);
}

/**
 * Skye lyrics. Sections are normalized to plain Title-Case brackets and human
 * annotations stripped, but any LRC timestamps the creator wrote are preserved
 * exactly — they drive the model's phonetic alignment.
 */
export function toSkyeLyrics(lyrics = '') {
  return rewriteSections(lyrics, (s) => `[${titleCase(s)}]`);
}

// ── Aurora (MiniMax-Music3) ─────────────────────────────────────────────────

/**
 * Aurora lyrics. Title-Case bracketed sections, matching the tag vocabulary the
 * studio's own lyric editor offers, with human annotations stripped so the model
 * never sings a stage direction.
 */
export function toAuroraLyrics(lyrics = '') {
  return rewriteSections(lyrics, (s) => `[${titleCase(s)}]`);
}

// ── dialect registry ────────────────────────────────────────────────────────


// Drives the shared Masters panel so a new engine needs a dialect entry, not a
// new panel. `styleLabel` and `styleHint` exist because telling a creator to
// "write tags" on a prose model is worse than saying nothing.
export const MODEL_DIALECTS = {
  coda: {
    name: 'Coda',
    engine: 'ACE-Step 1.5 XL Turbo',
    styleLabel: 'Style Prompt',
    styleHint: 'a dense comma-separated sonic description, because this model conditions on packed tokens rather than narrative prose.',
    toStyle: toHarmonixPrompt,
    toLyrics: toAceStepLyrics,
  },
  sirensong: {
    name: 'Siren Song',
    engine: 'HeartMuLa 3B',
    styleLabel: 'Style Tags',
    styleHint: 'comma-separated tag tokens, because this model reads tags rather than sentences.',
    toStyle: toSirenSongTags,
    toLyrics: toSirenSongLyrics,
  },
  skye: {
    name: 'Skye',
    engine: 'DiffRhythm 2',
    styleLabel: 'Style Prompt',
    styleHint: 'a natural-language sentence, because this model reads prose rather than tags.',
    toStyle: toSkyeStylePrompt,
    toLyrics: toSkyeLyrics,
  },
  aurora: {
    name: 'Aurora',
    engine: 'MiniMax-Music3',
    styleLabel: 'Structured Caption',
    styleHint: 'a headed Structured Caption — Global Metadata, Vocal Details, Arrangement — because this model was trained to follow that layout rather than a single description.',
    toStyle: toAuroraCaptionText,
    // Aurora's caption is edited as FIELDS, so the panel also hands the tab the
    // field set: writing only the compiled text would leave the builder blank
    // while the engine received a caption, and the two must never disagree.
    toCaptionFields: toAuroraCaptionFields,
    toLyrics: toAuroraLyrics,
  },
};