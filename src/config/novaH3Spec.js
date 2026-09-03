// Nova (MiniMax-H3) client-side spec — the studio's mirror of base44/shared/novaH3.ts.
//
// Kept as its own config rather than folded into ltxModelSpec: LTX and Nova are
// different engines with different constraints, and a shared table would force
// one of them to advertise something it cannot render. Nothing here touches LTX.

export const NOVA_FPS = 24;
const FRAMES_PER_CHUNK = 17;
const LATENTS_PER_CHUNK = 5;

// H3's video VAE only decodes 17n + 5 frames, so a requested length always
// rounds UP. The UI shows the snapped value because that is the length the file
// will actually have — a creator cutting to a bar needs the real number.
export function snapFrames(seconds) {
  let frames = Math.max(1, Math.round(seconds * NOVA_FPS));
  while (frames % FRAMES_PER_CHUNK !== LATENTS_PER_CHUNK) frames += 1;
  return frames;
}
export function snappedSeconds(seconds) {
  return snapFrames(seconds) / NOVA_FPS;
}

export const NOVA_MIN_DURATION = 2;
export const NOVA_MAX_DURATION = 14;
export const NOVA_DEFAULT_DURATION = 5;

// Labels must match the engine's table exactly — the label itself is the wire value.
export const NOVA_CANVASES = [
  { label: '960x544 · 16:9 fast', aspect: '16:9', tier: 'fast' },
  { label: '1024x576 · 16:9 fast', aspect: '16:9', tier: 'fast' },
  { label: '1152x640 · 16:9', aspect: '16:9', tier: 'standard' },
  { label: '1280x704 · 16:9', aspect: '16:9', tier: 'standard' },
  { label: '1344x768 · 16:9 full', aspect: '16:9', tier: 'full' },
  { label: '544x960 · 9:16 fast', aspect: '9:16', tier: 'fast' },
  { label: '640x1152 · 9:16', aspect: '9:16', tier: 'standard' },
  { label: '768x1344 · 9:16 full', aspect: '9:16', tier: 'full' },
  { label: '544x544 · 1:1 fast', aspect: '1:1', tier: 'fast' },
  { label: '768x768 · 1:1 full', aspect: '1:1', tier: 'full' },
  { label: '768x576 · 4:3 fast', aspect: '4:3', tier: 'fast' },
  { label: '1024x768 · 4:3 full', aspect: '4:3', tier: 'full' },
  { label: '576x768 · 3:4 fast', aspect: '3:4', tier: 'fast' },
  { label: '768x1024 · 3:4 full', aspect: '3:4', tier: 'full' },
  { label: '1152x512 · 21:9 fast', aspect: '21:9', tier: 'fast' },
  { label: '1536x672 · 21:9 full', aspect: '21:9', tier: 'full' },
];
export const NOVA_DEFAULT_CANVAS = '960x544 · 16:9 fast';
export const NOVA_ASPECTS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];

export const NOVA_PRESETS = [
  { id: 'balanced', name: 'Balanced', steps: 28, multiplier: 1, blurb: 'Best overall. Full 28-step schedule with conservative block-cache acceleration.' },
  { id: 'exact', name: 'Exact', steps: 28, multiplier: 1.3, blurb: 'Reference path — every block on every step, nothing reused. Highest fidelity.' },
  { id: 'ultra', name: 'Ultra cache', steps: 28, multiplier: 0.8, blurb: 'Forecasts the transformer residual across steps. Fast, but check the result.' },
  { id: 'turbo8', name: 'Turbo 8-step', steps: 8, multiplier: 0.55, blurb: 'Distilled LoRA, short schedule. Clean and quick — good for drafting shots.' },
  { id: 'turbo4', name: 'Turbo 4-step', steps: 4, multiplier: 0.4, blurb: 'Fastest possible pass. More artifacts — use it to audition a look.' },
];
export const NOVA_DEFAULT_PRESET = 'balanced';

// Mirrors novaCreditCost in the shared engine module — priced on GPU booking
// (frames × canvas × schedule), which is what a render actually costs us.
export function novaCreditCost(presetId, seconds, canvasLabel) {
  const p = NOVA_PRESETS.find((x) => x.id === presetId) || NOVA_PRESETS[0];
  const tier = (NOVA_CANVASES.find((c) => c.label === canvasLabel) || {}).tier || 'fast';
  const canvasFactor = tier === 'full' ? 1.5 : tier === 'standard' ? 1.25 : 1;
  const base = 6 + 1.4 * snappedSeconds(seconds);
  return Math.max(4, Math.round(base * p.multiplier * canvasFactor));
}

// Omni-reference limits straight from the model card.
export const NOVA_REF_LIMITS = { images: 9, videos: 3, audio: 3, total: 12 };