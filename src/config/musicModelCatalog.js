// Single source of truth for the music model catalog, shared by Quick Generate
// and Advanced Generate so a model added here appears in both without drifting.
//
// Grouped by PUBLIC model family; versions are revealed on select. Tempolor is
// the API provider behind TemPolor, Lyria, Mureka and MiniMax, but publicly each
// is presented as its own family.

// Sonic v5 is the platform default everywhere — a creator only leaves it when
// they pick something else themselves, or accept a Maestro recommendation.
export const DEFAULT_SONIC_MODEL = 'sonic-v5';
export const DEFAULT_TEMPOLOR_SONG_MODEL = 'tempolor-latest';
export const DEFAULT_TEMPOLOR_INSTRUMENTAL_MODEL = 'TemPolor i4';

// Sonic returns TWO tracks per generation; every other provider returns one.
export const TRACKS_PER_GENERATION = { sonic: 2, tempcolor: 1, elevenlabs: 1 };

export const SONIC_FAMILIES = [
  { name: 'Sonic', maker: 'Sonic AI', versions: [
    { value: 'sonic-v5', label: 'v5', desc: '⭐ Default — latest, 2 tracks per run' },
    { value: 'sonic-v5-5', label: 'v5.5', desc: 'Best quality' },
    { value: 'sonic-v4-5-plus', label: 'v4.5 Plus', desc: 'Premium quality' },
    { value: 'sonic-v4-5-all', label: 'v4.5 All', desc: 'Fast variant' },
    { value: 'sonic-v4-5', label: 'v4.5', desc: 'Enhanced vocals' },
    { value: 'sonic-v4', label: 'v4', desc: 'Improved quality' },
    { value: 'sonic-v3-5', label: 'v3.5', desc: 'Legacy' },
  ]},
];

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

// Human-readable label for any model id in the catalog
export function modelLabel(value) {
  const all = [...SONIC_FAMILIES, ...TEMPOLOR_SONG_FAMILIES, ...TEMPOLOR_INSTRUMENTAL_FAMILIES];
  for (const fam of all) {
    const hit = fam.versions.find(v => v.value === value);
    if (hit) return `${fam.name} ${hit.label}`;
  }
  return value || '';
}