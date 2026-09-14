/**
 * Sonic (aimusicapi.ai) model table — the ONE place backend functions resolve an
 * `mv` value. Provider notice 2026-09-09: Suno shipped v6 and retired v3.5–v5.5
 * on its side. Older ids are still accepted by the API at the same price, but a
 * request naming one is now RENDERED BY v6 upstream. We therefore resolve every
 * legacy id to the v6 model that actually produces the audio, so the model
 * recorded on a job / asset is the one that made the sound — a provenance row
 * saying "sonic-v5" for audio v6 rendered would be a false attestation.
 *
 * Accepted mv values: sonic-v6 · sonic-v6-wild · sonic-v6-mini (chirp-* aliases
 * work too). No price change: v6 costs what the models it replaces cost.
 */
export const SONIC_DEFAULT_MODEL = 'sonic-v6';

export const SONIC_MODELS: Record<string, { prompt: number; tags: number }> = {
  'sonic-v6':      { prompt: 5000, tags: 1000 },
  'sonic-v6-wild': { prompt: 5000, tags: 1000 },
  'sonic-v6-mini': { prompt: 5000, tags: 1000 },
};

// Every retired id, including the create-only / sample-only variants that used
// to need special handling. All of them now render as v6.
const LEGACY_IDS = new Set([
  'sonic-v3-5', 'sonic-v4', 'sonic-v4-5', 'sonic-v4-5-plus', 'sonic-v4-5-all', 'sonic-v5', 'sonic-v5-5',
]);

/** Resolve any requested model (legacy, chirp alias, unknown) to a live v6 id. */
export function resolveSonicModel(model?: string | null): string {
  const m = String(model || '').trim().toLowerCase().replace(/^chirp-/, 'sonic-');
  if (SONIC_MODELS[m]) return m;
  if (LEGACY_IDS.has(m)) return SONIC_DEFAULT_MODEL;
  return SONIC_DEFAULT_MODEL;
}

export function sonicLimits(model: string) {
  return SONIC_MODELS[resolveSonicModel(model)];
}

/** vocal_gender ('f' | 'm') is honoured on every v6 variant. */
export function sonicSupportsVocalGender(model: string): boolean {
  return resolveSonicModel(model) in SONIC_MODELS;
}