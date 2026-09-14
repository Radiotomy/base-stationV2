/**
 * Sonic (aimusicapi.ai) model table — the ONE place backend functions resolve an
 * `mv` value. Provider notice 2026-09-09: Suno shipped v6 (v6 / v6-wild / v6-mini)
 * and retired v3.5–v5.5 on its side. The older ids are STILL ACCEPTED by the API
 * at the same price, so a request naming one is passed through unchanged — but
 * Suno now renders it with v6 upstream, which `sonicRenderedBy()` reports so a
 * job or asset can record both what was asked for and what produced the sound.
 *
 * chirp-* aliases are normalised to sonic-*. No price change anywhere.
 */
export const SONIC_DEFAULT_MODEL = 'sonic-v6';

export const SONIC_MODELS: Record<string, { prompt: number; tags: number; deprecated?: boolean }> = {
  'sonic-v6':        { prompt: 5000, tags: 1000 },
  'sonic-v6-wild':   { prompt: 5000, tags: 1000 },
  'sonic-v6-mini':   { prompt: 5000, tags: 1000 },
  // Retired upstream — accepted, same price, rendered by v6.
  'sonic-v5-5':      { prompt: 5000, tags: 1000, deprecated: true },
  'sonic-v5':        { prompt: 5000, tags: 1000, deprecated: true },
  'sonic-v4-5-plus': { prompt: 5000, tags: 1000, deprecated: true },
  'sonic-v4-5-all':  { prompt: 5000, tags: 1000, deprecated: true },
  'sonic-v4-5':      { prompt: 5000, tags: 1000, deprecated: true },
  'sonic-v4':        { prompt: 3000, tags: 200,  deprecated: true },
  'sonic-v3-5':      { prompt: 3000, tags: 200,  deprecated: true },
};

/** Normalise a requested model; unknown ids fall back to the default. Legacy ids pass through. */
export function resolveSonicModel(model?: string | null): string {
  const m = String(model || '').trim().toLowerCase().replace(/^chirp-/, 'sonic-');
  return SONIC_MODELS[m] ? m : SONIC_DEFAULT_MODEL;
}

export function isLegacySonicModel(model: string): boolean {
  return !!SONIC_MODELS[resolveSonicModel(model)]?.deprecated;
}

/** The engine that actually renders a request — v6 for every retired id. */
export function sonicRenderedBy(model: string): string {
  const m = resolveSonicModel(model);
  return SONIC_MODELS[m].deprecated ? SONIC_DEFAULT_MODEL : m;
}

export function sonicLimits(model: string) {
  return SONIC_MODELS[resolveSonicModel(model)];
}

/** vocal_gender ('f' | 'm') is honoured on every model v4.5 and newer. */
export function sonicSupportsVocalGender(model: string): boolean {
  const m = resolveSonicModel(model);
  return m !== 'sonic-v3-5' && m !== 'sonic-v4';
}