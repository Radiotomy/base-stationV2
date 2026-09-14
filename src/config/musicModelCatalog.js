// Single source of truth for the music model catalog, shared by Quick Generate
// and Advanced Generate so a model added here appears in both without drifting.
//
// Grouped by PUBLIC model family; versions are revealed on select. Tempolor is
// the API provider behind TemPolor, Lyria, Mureka and MiniMax, but publicly each
// is presented as its own family.

// Sonic v6 is the platform default everywhere — a creator only leaves it when
// they pick something else themselves, or accept a Maestro recommendation.
export const DEFAULT_SONIC_MODEL = 'sonic-v6';
export const DEFAULT_TEMPOLOR_SONG_MODEL = 'tempolor-latest';
export const DEFAULT_TEMPOLOR_INSTRUMENTAL_MODEL = 'TemPolor i4';

// Sonic returns TWO tracks per generation; every other provider returns one.
export const TRACKS_PER_GENERATION = { sonic: 2, tempcolor: 1, elevenlabs: 1 };

// Sonic catalog — v6 update (provider notice 2026-09-09). Suno shipped v6, v6 Wild
// and v6 Mini and retired v3.5–v5.5 on its side. The older ids are still accepted
// by the API at the same price, so they stay selectable — flagged deprecated,
// because a request naming one is now rendered by v6 upstream.
export const SONIC_FAMILIES = [
  { name: 'Sonic', maker: 'Sonic AI', versions: [
    { value: 'sonic-v6', label: 'v6', desc: '⭐ Default — newest generation, 2 tracks per run, vocal gender control, up to 6 min' },
    { value: 'sonic-v6-wild', label: 'v6 Wild', desc: 'More adventurous — looser, more experimental takes on the same prompt' },
    { value: 'sonic-v6-mini', label: 'v6 Mini', desc: 'Lighter, faster variant — quick drafts and iteration' },
    { value: 'sonic-v5-5', label: 'v5.5', desc: 'Deprecated — still accepted, now rendered by v6', deprecated: true },
    { value: 'sonic-v5', label: 'v5', desc: 'Deprecated — still accepted, now rendered by v6', deprecated: true },
    { value: 'sonic-v4-5-plus', label: 'v4.5 Plus', desc: 'Deprecated — still accepted, now rendered by v6', deprecated: true },
    { value: 'sonic-v4-5', label: 'v4.5', desc: 'Deprecated — still accepted, now rendered by v6', deprecated: true },
    { value: 'sonic-v4', label: 'v4', desc: 'Deprecated — still accepted, now rendered by v6', deprecated: true },
    { value: 'sonic-v3-5', label: 'v3.5', desc: 'Deprecated — still accepted, now rendered by v6', deprecated: true },
  ]},
];

export const SONIC_LEGACY_MODELS = SONIC_FAMILIES[0].versions.filter(v => v.deprecated).map(v => v.value);
export function normalizeSonicModel(model) {
  const m = String(model || '').toLowerCase().replace(/^chirp-/, 'sonic-');
  return SONIC_FAMILIES[0].versions.some(v => v.value === m) ? m : DEFAULT_SONIC_MODEL;
}

// Models that accept `vocal_gender` ('f' | 'm') — v4.5 and newer.
export const SONIC_VOCAL_GENDER_MODELS = ['sonic-v6', 'sonic-v6-wild', 'sonic-v6-mini', 'sonic-v5-5', 'sonic-v5', 'sonic-v4-5-plus', 'sonic-v4-5'];
// Target-length range Sonic honours (integer seconds).
export const SONIC_DURATION_RANGE = { min: 10, max: 360 };

// BASE Station charges match Sonic's own credit table. v6 is priced exactly as
// the advanced models it replaced (no price change): 14 per generation.
export function sonicGenerationCost(_model, _customMode = true) {
  return 14;
}
export const SONIC_TOOL_COSTS = {
  remaster: 10, replace_section: 10, add_vocals: 10, add_instrumental: 10, concat: 2,
  upload: 2, stems_basic: 20, stems_full: 50,
};

// Tempolor catalog — re-audited from platform.tempolor.com/docs/6665893m0 (2026-08-23).
// TemPolor dropped version numbers on its house song model: one rolling
// "tempolor-latest" identifier instead of v4.6 / v3.5. The instrumental line is
// still numbered (i4 is the newest).
export const TEMPOLOR_SONG_FAMILIES = [
  { name: 'TemPolor', maker: 'TemPolor', versions: [
    { value: 'tempolor-latest', label: 'Latest', desc: '⭐ Flagship — best all-round, 5 min vocals, 30+ languages' },
  ]},
  { name: 'Mureka', maker: 'Kunlun Tech', versions: [
    { value: 'Mureka V9.5', label: 'V9.5', desc: '✨ Newest — richest arrangements, 5.5 min, 10+ languages' },
    { value: 'Mureka V9', label: 'V9', desc: 'Layered arrangements, 5.5 min — lower cost' },
  ]},
  { name: 'MiniMax', maker: 'MiniMax', versions: [
    { value: 'MiniMax 3.0', label: '3.0', desc: 'Premium vocals — longest tracks (6 min)' },
  ]},
  { name: 'Lyria', maker: 'Google DeepMind', versions: [
    { value: 'Lyria 3 Pro', label: '3 Pro', desc: 'Natural, lifelike vocals — 3 min, multilingual' },
  ]},
  // Eleven Music is deliberately NOT listed — ElevenLabs is called directly from
  // its own tab, so routing it through Tempolor would be redundant.
];

export const TEMPOLOR_INSTRUMENTAL_FAMILIES = [
  { name: 'TemPolor', maker: 'TemPolor', versions: [
    { value: 'TemPolor i4', label: 'i4', desc: '⭐ New flagship instrumental — best sound quality, 3 min' },
    { value: 'TemPolor i3', label: 'i3', desc: 'Fastest (<3s) & most cost-effective — 2 min, prompt duration control' },
  ]},
  { name: 'Mureka', maker: 'Kunlun Tech', versions: [
    { value: 'Mureka V9', label: 'V9', desc: 'Rich, layered arrangements — 4.5 min' },
  ]},
  { name: 'MiniMax', maker: 'MiniMax', versions: [
    { value: 'MiniMax 3.0', label: '3.0', desc: 'Premium — longest instrumentals (6 min)' },
  ]},
  { name: 'Lyria', maker: 'Google DeepMind', versions: [
    { value: 'Lyria 3 Pro', label: '3 Pro', desc: 'Clean instrumentals — 3 min' },
  ]},
];

// Resolve free text (e.g. "Mureka V9.5", "minimax 3.0") to a catalog model id
// plus the provider that serves it. Returns null when nothing matches, so a
// Maestro suggestion can never silently route to a model we don't offer.
export function resolveModelId(text = '') {
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const sonicId = t.replace(/^chirp-/, 'sonic-');
  if (SONIC_FAMILIES[0].versions.some(v => v.value === sonicId)) return { model: sonicId, provider: 'sonic' };
  const groups = [
    { provider: 'sonic', families: SONIC_FAMILIES },
    { provider: 'tempcolor', families: TEMPOLOR_SONG_FAMILIES },
    { provider: 'tempcolor', families: TEMPOLOR_INSTRUMENTAL_FAMILIES },
  ];
  for (const { provider, families } of groups) {
    for (const fam of families) {
      for (const v of fam.versions) {
        const full = `${fam.name} ${v.label}`.toLowerCase();
        if (t === v.value.toLowerCase() || t === full || t.includes(full)) {
          return { model: v.value, provider };
        }
      }
    }
  }
  return null;
}

// Human-readable label for any model id in the catalog
export function modelLabel(value) {
  const all = [...SONIC_FAMILIES, ...TEMPOLOR_SONG_FAMILIES, ...TEMPOLOR_INSTRUMENTAL_FAMILIES];
  for (const fam of all) {
    const hit = fam.versions.find(v => v.value === value);
    if (hit) return `${fam.name} ${hit.label}`;
  }
  return value || '';
}