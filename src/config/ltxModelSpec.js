// LTX model capabilities for the Video Studio UI — mirrors base44/shared/ltxSpec.ts.
// Kept in sync deliberately: the backend re-validates and coerces every request,
// so this file only decides what a creator can *see* and pick.
//
// ltx-2-fast / ltx-2-pro were removed from the LTX API on 2026-08-16 and must
// never be offered again.

export const LTX_MODELS = [
  {
    value: 'ltx-2-5-fast',
    label: '2.5 Fast',
    family: 'LTX-2.5',
    desc: 'Up to 4K · clips to 20s · multi-shot',
    tiers: ['720p', '1080p', '1440p', '4k'],
    fps: [24, 25, 48, 50],
    maxLongDuration: 20,
    modes: ['text', 'image', 'audio'],
    autoDuration: true,
    creditsPerSecond: { '720p': 2, '1080p': 3, '1440p': 4, '4k': 6 },
  },
  {
    value: 'ltx-2-5-pro',
    label: '2.5 Pro',
    family: 'LTX-2.5',
    desc: 'Highest fidelity · to 1080p · 10s',
    tiers: ['720p', '1080p'],
    fps: [24, 25, 50],
    maxLongDuration: 10,
    modes: ['text', 'image', 'audio'],
    autoDuration: true,
    creditsPerSecond: { '720p': 3, '1080p': 4 },
  },
  {
    value: 'ltx-2-3-fast',
    label: '2.3 Fast',
    family: 'LTX-2.3',
    desc: 'Cheapest · up to 4K · clips to 20s',
    tiers: ['720p', '1080p', '1440p', '4k'],
    fps: [24, 25, 48, 50],
    maxLongDuration: 20,
    modes: ['text', 'image'],
    autoDuration: false,
    creditsPerSecond: { '720p': 1, '1080p': 2, '1440p': 3, '4k': 5 },
  },
  {
    value: 'ltx-2-3-pro',
    label: '2.3 Pro',
    family: 'LTX-2.3',
    desc: 'Up to 4K · 10s · first-to-last frame',
    tiers: ['720p', '1080p', '1440p', '4k'],
    fps: [24, 25, 48, 50],
    maxLongDuration: 10,
    modes: ['text', 'image', 'audio'],
    autoDuration: false,
    creditsPerSecond: { '720p': 1, '1080p': 2, '1440p': 4, '4k': 7 },
  },
];

export const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9', desc: 'Landscape / YouTube' },
  { value: '9:16', label: '9:16', desc: 'Portrait / Reels' },
];

export const CAMERA_MOTIONS = [
  { value: '', label: 'None' },
  { value: 'static', label: 'Static' },
  { value: 'dolly_in', label: 'Dolly In' },
  { value: 'dolly_out', label: 'Dolly Out' },
  { value: 'dolly_left', label: 'Dolly Left' },
  { value: 'dolly_right', label: 'Dolly Right' },
  { value: 'jib_up', label: 'Jib Up' },
  { value: 'jib_down', label: 'Jib Down' },
  { value: 'focus_shift', label: 'Focus Shift' },
];

export const getModelSpec = (value) =>
  LTX_MODELS.find(m => m.value === value) || LTX_MODELS[0];

/** Durations the model allows — 1440p/4K and 48/50 fps both cap a clip at 10s. */
export function durationsFor(model, tier, fps) {
  const spec = getModelSpec(model);
  if (tier === '1440p' || tier === '4k') return [6, 8, 10];
  if (fps >= 48) return [6, 8, 10];
  return [6, 8, 10, 12, 14, 16, 18, 20].filter(d => d <= spec.maxLongDuration);
}

/** Longest input audio audio-to-video accepts for this model + resolution. */
export function maxAudioSeconds(model, tier) {
  const spec = getModelSpec(model);
  if (spec.maxLongDuration === 10) return 10;
  return (tier === '1440p' || tier === '4k') ? 10 : 20;
}

export function creditCost(model, tier, seconds) {
  const spec = getModelSpec(model);
  const rate = spec.creditsPerSecond[tier] ?? spec.creditsPerSecond['1080p'] ?? 3;
  return Math.max(rate, Math.round(rate * seconds));
}