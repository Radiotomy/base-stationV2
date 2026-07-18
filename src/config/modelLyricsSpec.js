/**
 * Per-model lyrics & prompting capability spec — single source of truth.
 * Mirrors backend truncation rules in generateMusic:
 *   Sonic:    lyrics go in `prompt` — 3000 chars (v3.5/v4, no vocals) / 5000 (v4.5+)
 *   Producer: lyrics ≤ 5000 chars
 *   Tempolor: lyrics ≤ 3000 chars (ALL song models), prompt ≤ 1000 chars
 * Anything over the limit is hard-truncated by the provider — songs get cut mid-verse.
 */

const SPECS = {
  sonic: {
    default: { maxLyricsChars: 5000, structureTags: true, vocal: true, languages: 'Multilingual' },
    models: {
      'sonic-v3-5': { maxLyricsChars: 3000, vocal: false, notes: 'Legacy — no vocal support (auto-upgraded to v4.5 for vocals)' },
      'sonic-v4':   { maxLyricsChars: 3000, vocal: false, notes: 'Legacy — no vocal support (auto-upgraded to v4.5 for vocals)' },
    },
  },
  producer: {
    // Producer API is powered by Google Lyria 3 Pro (FUZZ-* models retired upstream Apr 2026,
    // silently aliased to Lyria 3 Pro per docs.musicapi.ai migration notice).
    default: { maxLyricsChars: 5000, structureTags: true, vocal: true, languages: 'Multilingual' },
    models: {
      'Lyria 3 Pro': { notes: 'By Google — Suno v5-class quality, ~30s generation' },
    },
  },
  tempcolor: {
    default: { maxLyricsChars: 3000, structureTags: true, vocal: true, languages: 'Multilingual' },
    models: {
      'TemPolor v4.6': { languages: '30+ languages' },
      'TemPolor v3.5': { languages: 'English, Chinese, Cantonese, Japanese ONLY', notes: 'Lyrics in other languages may produce poor or failed vocals' },
      'Mureka V9':     { languages: '10+ languages' },
      'TemPolor i3.5': { vocal: false, notes: 'Instrumental-only model — lyrics are ignored' },
      'TemPolor i3':   { vocal: false, notes: 'Instrumental-only model — lyrics are ignored' },
    },
  },
  elevenlabs: {
    // Eleven Music: single prompt ≤ 4100 chars — lyrics ride inside the prompt,
    // so we budget 3500 chars for lyrics leaving room for the style description.
    default: { maxLyricsChars: 3500, structureTags: true, vocal: true, languages: 'Multilingual' },
    models: {
      'music_v2': { notes: 'v2 outputs 48kHz high-fidelity audio' },
    },
  },
};

export function getLyricsSpec(provider, model) {
  const p = SPECS[provider] || SPECS.sonic;
  return { ...p.default, ...(p.models?.[model] || {}) };
}

/** Returns { ok, chars, maxChars, spec, issues: [{ level: 'error'|'warn'|'tip', msg }] } */
export function checkLyricsCompatibility({ lyrics = '', provider, model, mode = 'song' }) {
  const spec = getLyricsSpec(provider, model);
  const chars = lyrics.length;
  const issues = [];

  if (mode === 'instrumental' || spec.vocal === false) {
    issues.push({ level: 'warn', msg: `${model} is instrumental-only — your lyrics will be ignored. Switch to a vocal model to use them.` });
  } else {
    if (chars > spec.maxLyricsChars) {
      issues.push({ level: 'error', msg: `Lyrics are ${chars.toLocaleString()} characters but ${model} accepts max ${spec.maxLyricsChars.toLocaleString()} — the song will be CUT OFF mid-verse. Shorten the lyrics or pick a model with a larger budget.` });
    } else if (chars > spec.maxLyricsChars * 0.9) {
      issues.push({ level: 'warn', msg: `Lyrics are near ${model}'s ${spec.maxLyricsChars.toLocaleString()}-character limit (${chars.toLocaleString()} used).` });
    }
    if (chars > 0 && spec.structureTags && !/\[[^\]]+\]/.test(lyrics)) {
      issues.push({ level: 'tip', msg: `Add [Verse] / [Chorus] / [Bridge] section tags — ${model} uses them to structure the song.` });
    }
    if (spec.notes && spec.vocal !== false) {
      issues.push({ level: 'tip', msg: spec.notes });
    }
  }

  return { ok: !issues.some(i => i.level === 'error'), chars, maxChars: spec.maxLyricsChars, spec, issues };
}