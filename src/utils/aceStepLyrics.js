// ACE-Step v1.5 (BASE-Harmonix) lyric grammar.
//
// Harmonix does NOT read prose-formatted lyrics the way Sonic does. It conditions
// on a small, fixed set of lowercase structure tags and treats anything else as
// sung text — so a stray "[Verse 1 — the hook lands here]" gets vocalised
// literally. This converts 243 Masters output (Title Case, numbered, occasionally
// annotated sections) into the exact tag set the model was trained on.

const SUPPORTED = ['intro', 'verse', 'pre-chorus', 'chorus', 'hook', 'bridge', 'breakdown', 'instrumental', 'outro'];

// Everything the Masters engine realistically emits, mapped to its nearest
// trained equivalent. Unmapped sections fall back to [verse] rather than being
// dropped — losing a section costs more than mislabelling one.
const ALIASES = {
  'refrain': 'chorus',
  'post-chorus': 'chorus',
  'prechorus': 'pre-chorus',
  'pre chorus': 'pre-chorus',
  'drop': 'breakdown',
  'solo': 'instrumental',
  'interlude': 'instrumental',
  'intro/hook': 'intro',
  'verse/rap': 'verse',
  'rap': 'verse',
  'tag': 'outro',
  'coda': 'outro',
  'ad-lib': 'hook',
  'adlib': 'hook',
};

function normalizeTag(raw) {
  // Strip section numbers and annotations: "Verse 2 (half-time)" -> "verse"
  let t = raw.toLowerCase().replace(/\(.*?\)/g, '').replace(/[—–-]\s*.*$/, '').trim();
  t = t.replace(/\s*\d+\s*$/, '').trim();
  if (SUPPORTED.includes(t)) return t;
  if (ALIASES[t]) return ALIASES[t];
  const partial = SUPPORTED.find(s => t.includes(s));
  return partial || 'verse';
}

/**
 * Convert sectioned lyrics into ACE-Step tag format.
 * Lines outside any section are kept and attached to the section above them.
 */
export function toAceStepLyrics(lyrics = '') {
  const lines = String(lyrics).split('\n');
  const out = [];
  let sawTag = false;

  for (const line of lines) {
    const match = line.trim().match(/^\[([^\]]+)\]$/);
    if (match) {
      sawTag = true;
      const tag = `[${normalizeTag(match[1])}]`;
      // Collapse consecutive duplicate tags (e.g. [chorus] immediately re-tagged)
      if (out[out.length - 1] !== tag) {
        if (out.length) out.push('');
        out.push(tag);
      }
    } else {
      out.push(line.trimEnd());
    }
  }

  // No structure at all — wrap the whole thing so Harmonix still gets a section.
  if (!sawTag) return `[verse]\n${String(lyrics).trim()}`;

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Groove beds per genre. ACE-Step's guide is explicit that single-dimension
// captions "give the model too much room to play" — and a wandering rhythm
// section is exactly how that shows up. Genres that live on a pocket (R&B, soul,
// funk) get the rhythm section named explicitly plus a hold-the-groove cue, which
// is what stops the band hesitating around the vocal.
const GROOVE_BEDS = {
  'r&b': 'steady locked pocket, fatback drums with tight snare, persistent electric bass line, Rhodes electric piano, warm analog production, rhythm section holds throughout under the vocal, no dropouts',
  soul: 'classic soul rhythm section, vintage Motown-Memphis groove, steady tambourine and kick pocket, walking bass, Hammond organ and horn section, warm tape saturation, continuous groove beneath the vocal, no dropouts',
  'hip-hop': 'hard looped drum break, steady 808 sub bass, consistent groove throughout, no dropouts',
  funk: 'syncopated funk pocket, slap bass, tight rhythm guitar skank, punchy horn stabs, groove never stops',
  pop: 'punchy consistent drum groove, driving bass, full arrangement sustained under the vocal',
  country: 'steady brushed drum groove, upright and electric bass, acoustic guitar bed, pedal steel, consistent arrangement',
  rock: 'driving drum groove, distorted rhythm guitar bed, steady bass, sustained band arrangement',
  edm: 'four-on-the-floor kick, sustained sidechained bass, continuous rhythmic energy',
  'lo-fi': 'dusty laid-back drum loop, mellow steady bass, continuous relaxed groove',
  folk: 'gentle fingerpicked acoustic bed, steady soft percussion, continuous arrangement',
  afrobeats: 'rolling afrobeats percussion pocket, steady log-drum bass, continuous groove',
};

// Tempo / feel defaults per genre, used when the creator hasn't pinned a tempo.
// An unset BPM makes the model guess the pocket, which is the main cause of the
// band drifting against the vocal phrasing.
export const GENRE_GROOVE_DEFAULTS = {
  'r&b': { bpm: 82, time_signature: '4' },
  soul: { bpm: 72, time_signature: '4' },
  'hip-hop': { bpm: 88, time_signature: '4' },
  funk: { bpm: 104, time_signature: '4' },
  pop: { bpm: 116, time_signature: '4' },
  country: { bpm: 98, time_signature: '4' },
  rock: { bpm: 124, time_signature: '4' },
  edm: { bpm: 126, time_signature: '4' },
  'lo-fi': { bpm: 78, time_signature: '4' },
  folk: { bpm: 92, time_signature: '3' },
  afrobeats: { bpm: 106, time_signature: '4' },
};

export function getGrooveDefaults(genre = '') {
  return GENRE_GROOVE_DEFAULTS[String(genre).toLowerCase()] || { bpm: 110, time_signature: '4' };
}

/**
 * Build the Harmonix style prompt from a Masters brief. Harmonix wants a dense
 * comma-separated sonic description, not a narrative paragraph — and a named
 * rhythm section, or it improvises one per section.
 */
export function toHarmonixPrompt(brief = {}, { genre, mood } = {}) {
  const bed = GROOVE_BEDS[String(genre || '').toLowerCase()] || '';
  const parts = [
    genre,
    mood,
    brief.key ? `key of ${brief.key}` : '',
    brief.bpm ? `${brief.bpm} BPM` : '',
    brief.production_brief || '',
    bed,
  ].filter(Boolean);
  // The model caps the caption at 512 chars; the groove bed is the part that
  // must survive, so it is appended last and the whole thing trimmed to fit.
  return parts.join(', ').replace(/\s+/g, ' ').trim().slice(0, 512);
}