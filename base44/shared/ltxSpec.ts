// LTX API capability spec — the single server-side source of truth for which
// model / resolution / fps / duration combinations the current LTX API accepts,
// and what each second of output costs in BASE Station credits.
//
// Current as of the LTX docs audit (Aug 2026):
//   • Host  https://api.ltx.io  (api.ltx.video still resolves, but is legacy)
//   • Sync  POST /v1/{endpoint}  → returns the raw MP4 body
//   • Async POST /v2/{endpoint}  → 202 { id }, then GET /v2/{endpoint}/{id}
//     We use ASYNC everywhere: video renders outlive an HTTP connection.
//   • ltx-2-fast / ltx-2-pro were REMOVED on 2026-08-16 — requests error out.
//     Live models: ltx-2-5-{fast,pro} and ltx-2-3-{fast,pro}.
//   • Results (and their URLs) are retained for 24h only, so every finished
//     job must be copied into our own storage — jobFinalize does that.

export const LTX_API_BASE = 'https://api.ltx.io';

// Studio mode → API endpoint. Retake / extend / reframe / HDR upscale also exist
// (ltx-2-3-pro only) and are not surfaced in the studio yet.
export const LTX_ENDPOINTS: Record<string, string> = {
  text: 'text-to-video',
  image: 'image-to-video',
  audio: 'audio-to-video',
};

const TIER_DIMENSIONS: Record<string, [number, number]> = {
  '720p': [1280, 720],
  '1080p': [1920, 1080],
  '1440p': [2560, 1440],
  '4k': [3840, 2160],
};

const ALL_TIERS = ['720p', '1080p', '1440p', '4k'];

export const LTX_MODELS: Record<string, any> = {
  'ltx-2-5-fast': {
    label: 'LTX-2.5 Fast',
    tiers: ALL_TIERS,
    fps: [24, 25, 48, 50],
    maxLongDuration: 20,
    modes: ['text', 'image', 'audio'],
    autoDuration: true,
    creditsPerSecond: { '720p': 2, '1080p': 3, '1440p': 4, '4k': 6 },
  },
  'ltx-2-5-pro': {
    label: 'LTX-2.5 Pro',
    tiers: ['720p', '1080p'],
    fps: [24, 25, 50],
    maxLongDuration: 10,
    modes: ['text', 'image', 'audio'],
    autoDuration: true,
    creditsPerSecond: { '720p': 3, '1080p': 4 },
  },
  'ltx-2-3-fast': {
    label: 'LTX-2.3 Fast',
    tiers: ALL_TIERS,
    fps: [24, 25, 48, 50],
    maxLongDuration: 20,
    modes: ['text', 'image'],
    autoDuration: false,
    creditsPerSecond: { '720p': 1, '1080p': 2, '1440p': 3, '4k': 5 },
  },
  'ltx-2-3-pro': {
    label: 'LTX-2.3 Pro',
    tiers: ALL_TIERS,
    fps: [24, 25, 48, 50],
    maxLongDuration: 10,
    modes: ['text', 'image', 'audio'],
    autoDuration: false,
    creditsPerSecond: { '720p': 1, '1080p': 2, '1440p': 4, '4k': 7 },
  },
};

/** "1920x1080" for the tier, swapped for portrait. */
export function ltxResolution(tier: string, aspect: string): string {
  const [w, h] = TIER_DIMENSIONS[tier] || TIER_DIMENSIONS['1080p'];
  return aspect === '9:16' ? `${h}x${w}` : `${w}x${h}`;
}

/**
 * Durations the model actually allows. High resolutions and high frame rates
 * both cap a clip at 10s, so a 20s 4K request is rejected upstream, not here.
 */
export function ltxDurations(model: string, tier: string, fps: number): number[] {
  const spec = LTX_MODELS[model];
  if (!spec) return [6, 8, 10];
  const short = [6, 8, 10];
  if (tier === '1440p' || tier === '4k') return short;
  if (fps >= 48) return short;
  const all = [6, 8, 10, 12, 14, 16, 18, 20];
  return all.filter(d => d <= spec.maxLongDuration);
}

/** Longest input audio audio-to-video accepts for this model + resolution. */
export function ltxMaxAudioSeconds(model: string, tier: string): number {
  const spec = LTX_MODELS[model];
  if (!spec) return 10;
  if (spec.maxLongDuration === 10) return 10;
  return (tier === '1440p' || tier === '4k') ? 10 : 20;
}

/** Credits for a render. Auto/audio-driven lengths bill against the maximum. */
export function ltxCreditCost(model: string, tier: string, seconds: number): number {
  const spec = LTX_MODELS[model] || LTX_MODELS['ltx-2-5-fast'];
  const rate = spec.creditsPerSecond[tier] ?? spec.creditsPerSecond['1080p'] ?? 3;
  return Math.max(rate, Math.round(rate * seconds));
}

/**
 * Coerce a request onto a combination the API accepts, so a stale client can
 * never spend credits on a call LTX will reject.
 * Returns { model, tier, fps, duration, resolution, endpoint } or { error }.
 */
export function ltxNormalize({ mode, model, tier, fps, duration, aspect }: any) {
  const endpoint = LTX_ENDPOINTS[mode];
  if (!endpoint) return { error: `Unsupported mode "${mode}"` };

  const chosen = LTX_MODELS[model] ? model : 'ltx-2-5-fast';
  const spec = LTX_MODELS[chosen];
  if (!spec.modes.includes(mode)) {
    return { error: `${spec.label} does not support ${endpoint}. Pick a different model.` };
  }

  const safeTier = spec.tiers.includes(tier) ? tier : (spec.tiers.includes('1080p') ? '1080p' : spec.tiers[0]);
  const safeFps = spec.fps.includes(Number(fps)) ? Number(fps) : 24;

  let safeDuration: number | null = null;
  if (mode === 'audio') {
    // Length comes from the uploaded audio — duration must not be sent at all.
    safeDuration = null;
  } else if (duration === null || duration === undefined) {
    if (!spec.autoDuration) {
      safeDuration = ltxDurations(chosen, safeTier, safeFps).slice(-1)[0];
    }
  } else {
    const allowed = ltxDurations(chosen, safeTier, safeFps);
    safeDuration = allowed.includes(Number(duration))
      ? Number(duration)
      : allowed.reduce((best, d) => (Math.abs(d - Number(duration)) < Math.abs(best - Number(duration)) ? d : best), allowed[0]);
  }

  return {
    endpoint,
    model: chosen,
    tier: safeTier,
    fps: safeFps,
    duration: safeDuration,
    resolution: ltxResolution(safeTier, aspect === '9:16' ? '9:16' : '16:9'),
  };
}

export const LTX_CAMERA_MOTIONS = [
  'dolly_in', 'dolly_out', 'dolly_left', 'dolly_right',
  'jib_up', 'jib_down', 'static', 'focus_shift',
];