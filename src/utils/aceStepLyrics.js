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

/**
 * Build the Harmonix style prompt from a Masters brief. Harmonix wants a dense
 * comma-separated sonic description, not a narrative paragraph.
 */
export function toHarmonixPrompt(brief = {}, { genre, mood } = {}) {
  const parts = [
    genre,
    mood,
    brief.key ? `key of ${brief.key}` : '',
    brief.bpm ? `${brief.bpm} BPM` : '',
    brief.production_brief || '',
  ].filter(Boolean);
  return parts.join(', ').replace(/\s+/g, ' ').trim();
}