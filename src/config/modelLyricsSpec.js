/**
 * Per-model lyrics & prompting capability spec — single source of truth.
 * Mirrors backend truncation rules in generateMusic:
 *   Sonic:    lyrics go in `prompt` — 5000 chars on every v6 variant (retired
 *             v3.5–v5.5 ids are rendered by v6 upstream and share that budget)
 *   Producer: lyrics ≤ 5000 chars
 *   Tempolor: lyrics ≤ 3000 chars (ALL song models), prompt ≤ 1000 chars
 * Anything over the limit is hard-truncated by the provider — songs get cut mid-verse.
 */

const SPECS = {
  sonic: {
    default: { maxLyricsChars: 5000, structureTags: true, vocal: true, languages: 'Multilingual' },
    models: {
      'sonic-v6-wild': { notes: 'Wild variant — more experimental arrangements; keep section tags explicit to hold structure' },
      'sonic-v6-mini': { notes: 'Mini variant — fastest v6 render, best for drafting' },
      'sonic-v3-5': { maxLyricsChars: 3000, notes: 'Deprecated — accepted, rendered by v6 upstream' },
      'sonic-v4':   { maxLyricsChars: 3000, notes: 'Deprecated — accepted, rendered by v6 upstream' },
    },
  },
  producer: {
    // Not exposed in the UI — Lyria models are offered to users via the Tempolor provider.
    default: { maxLyricsChars: 5000, structureTags: true, vocal: true, languages: 'Multilingual' },
  },
  tempcolor: {
    default: { maxLyricsChars: 3000, structureTags: true, vocal: true, languages: 'Multilingual' },
    models: {
      // TemPolor's house song model is now a single rolling "tempolor-latest"
      // identifier — the numbered v4.6 / v3.5 entries no longer exist upstream.
      'tempolor-latest': { languages: '30+ languages' },
      'Mureka V9.5':     { languages: '10+ languages' },
      'Mureka V9':       { languages: '10+ languages' },
      'MiniMax 3.0':     { languages: 'Multilingual' },
      'Eleven Music V2': { maxLyricsChars: 3500, languages: 'Multilingual', notes: 'Premium tier — costs significantly more per track upstream' },
      'TemPolor i4':     { vocal: false, notes: 'Instrumental-only model — lyrics are ignored' },
      'TemPolor i3':     { vocal: false, notes: 'Instrumental-only model — lyrics are ignored' },
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