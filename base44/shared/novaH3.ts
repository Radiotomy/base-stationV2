// Nova — BASE Station's cinematic video engine, powered by MiniMax-H3
// (huggingface.co/MiniMaxAI/MiniMax-H3), self-hosted on our own Hugging Face
// ZeroGPU Space (huggingface.co/spaces/Radiotomy/Nova-H3).
//
// WHY THIS IS A SEPARATE ENGINE FROM LTX — load-bearing, do not merge:
//   LTX is a per-second cloud API with its own model ladder, its own resolution
//   tiers and its own private-Space fallback chain. Nova is a single self-hosted
//   checkpoint whose length, canvas and step schedule are dictated by the model's
//   own VAE. Folding Nova into ltxSpec would force one of them to lie about what
//   it can render. Nothing in this module touches the LTX path.
//
// LICENCE — MiniMax-H3 Community License. Commercial use is free below the
// revenue threshold, but the licence requires the "MiniMax-H3" name to be shown
// on the UI of any product using it, and requires maintained safeguards against
// infringing / AUP-violating output. That is why the attribution component is a
// permanent part of the Nova panel and why screenNovaRequest() runs before any
// GPU booking is spent — the same discipline Aurora uses for MiniMax-Music3.
//
// WHAT MAKES H3 DIFFERENT FROM EVERY OTHER VIDEO MODEL WE RUN:
//   The picture and its stereo soundtrack are denoised in the SAME packed
//   sequence, so the audio is generated WITH the image rather than dubbed on
//   afterwards. That is the whole reason it earns a place next to LTX for music
//   work: a performance clip's room tone, crowd and transient hits land on the
//   frames they belong to.
//
// ENGINE CONTRACT — the same persistence-first shape every other BASE Station
// engine uses, served by our own nova_jobs module on the Space:
//   POST /nova/submit         -> { job_id }
//   GET  /nova/job/{job_id}   -> { status, video_url, report, error }
//   GET  /nova/file/{name}    -> the rendered MP4
// Deliberately NOT Gradio's /gradio_api/call/generate stream: that handle is
// one-shot, so a browser that blinks mid-render loses a finished job it already
// paid GPU time for. A job record on the engine can be asked the same question
// as many times as a creator's tab needs.

const ENGINE_BASE = 'https://radiotomy-nova-h3.hf.space';

const SUBMIT_TIMEOUT_MS = 60000;
const POLL_TIMEOUT_MS = 20000;
const DOWNLOAD_TIMEOUT_MS = 180000;

export const NOVA_MODEL_ID = 'MiniMaxAI/MiniMax-H3';
export const NOVA_MODEL_LABEL = 'Nova (MiniMax-H3)';

// H3 outputs 24 fps video with 32 kHz stereo audio, always.
export const NOVA_FPS = 24;
export const NOVA_AUDIO_SAMPLE_RATE = 32000;

// The video VAE decodes 17n + 5 frames and nothing else, so a requested length
// is always rounded UP to the next decodable frame count. Surfacing the real
// length matters: a creator cutting to a bar line needs the number the file will
// actually have, not the one they typed.
const FRAMES_PER_CHUNK = 17;
const LATENTS_PER_CHUNK = 5;

export function snapFrames(seconds: number): number {
  let frames = Math.max(1, Math.round(seconds * NOVA_FPS));
  while (frames % FRAMES_PER_CHUNK !== LATENTS_PER_CHUNK) frames += 1;
  return frames;
}

export function snappedSeconds(seconds: number): number {
  return snapFrames(seconds) / NOVA_FPS;
}

// The Space's own duration window. 15s snaps to 362 frames (15.083s) and is
// refused by the engine, so 14 is the honest ceiling.
export const NOVA_MIN_DURATION = 2;
export const NOVA_MAX_DURATION = 14;
export const NOVA_DEFAULT_DURATION = 5;

// Canvas labels must match the engine's table EXACTLY — the label itself goes
// over the wire and an unknown one is rejected there, not here.
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

// Step schedules. Each entry carries the exact preset label the engine expects
// plus the credit multiplier for the GPU booking it costs us.
export const NOVA_PRESETS = {
  balanced: {
    label: 'Balanced — best overall (recommended)',
    steps: 28,
    acceleration: 'Balanced',
    multiplier: 1,
  },
  turbo8: {
    label: 'Turbo 8-step — faster, cleaner',
    steps: 8,
    acceleration: 'Exact',
    multiplier: 0.55,
  },
  turbo4: {
    label: 'Turbo 4-step — fastest, more artifacts',
    steps: 4,
    acceleration: 'Exact',
    multiplier: 0.4,
  },
  exact: {
    label: 'Exact 28-step — maximum fidelity',
    steps: 28,
    acceleration: 'Exact',
    multiplier: 1.3,
  },
  ultra: {
    label: 'Ultra cache — experimental speed',
    steps: 28,
    acceleration: 'Ultra Fast',
    multiplier: 0.8,
  },
};
export const NOVA_DEFAULT_PRESET = 'balanced';

// Credits. Priced on GPU booking, which scales with frames × canvas area × steps
// rather than on wall-clock: a cache preset finishes sooner but books the same
// worker, so the schedule multiplier is what a creator is actually paying for.
export function novaCreditCost(preset: string, seconds: number, canvas: string): number {
  const p = NOVA_PRESETS[preset] || NOVA_PRESETS[NOVA_DEFAULT_PRESET];
  const tier = (NOVA_CANVASES.find((c) => c.label === canvas) || {}).tier || 'fast';
  const canvasFactor = tier === 'full' ? 1.5 : tier === 'standard' ? 1.25 : 1;
  const base = 6 + 1.4 * snappedSeconds(seconds);
  return Math.max(4, Math.round(base * p.multiplier * canvasFactor));
}

// AUP guard (licence safeguard clause). Narrow by design — it blocks the
// categories the policy names and nothing else, because a broad keyword filter
// that refuses ordinary creative briefs teaches creators to route around the
// safeguard instead of working inside it.
const AUP_PATTERNS: [RegExp, string][] = [
  [/\b(deepfake|face[- ]?swap|impersonat\w*)\b/i, 'Impersonation or deepfaking a real person'],
  [/\b(child|minor|underage)\b.{0,40}\b(sexual|explicit|nude|nsfw)/i, 'Content sexualising minors'],
  [/\b(terrorist recruitment|violent extremis)/i, 'Violent extremism or terrorism'],
  [/\bincite\b.{0,20}\b(violence|genocide|hatred)\b/i, 'Incitement to violence or hatred'],
  [/\b(pornographic|hardcore porn|explicit sex scene)\b/i, 'Sexually explicit content'],
];

export function screenNovaRequest(prompt: string): string | null {
  for (const [pattern, reason] of AUP_PATTERNS) {
    if (pattern.test(prompt || '')) return reason;
  }
  return null;
}

export function isNovaOutputUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith(`${ENGINE_BASE}/`);
}

/**
 * Queue a render. Returns the engine's job id — the engine has already written
 * its own record by the time this resolves, so a booked render can never be
 * orphaned by a lost response on our side.
 */
export async function submitNovaJob({
  prompt, canvas, duration, preset, seed,
  firstFrameUrl, lastFrameUrl, references, enhancePrompt,
}: {
  prompt: string; canvas: string; duration: number; preset: string; seed: number;
  firstFrameUrl?: string; lastFrameUrl?: string; references?: string[]; enhancePrompt?: boolean;
}) {
  const p = NOVA_PRESETS[preset] || NOVA_PRESETS[NOVA_DEFAULT_PRESET];
  const payload = {
    prompt,
    canvas,
    duration,
    steps: p.steps,
    seed,
    upsample: !!enhancePrompt,
    acceleration: p.acceleration,
    generation_preset: p.label,
    first_frame_url: firstFrameUrl || '',
    last_frame_url: lastFrameUrl || '',
    references: (references || []).filter(Boolean),
  };

  const res = await fetch(`${ENGINE_BASE}/nova/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Nova engine HTTP ${res.status}${t ? `: ${t.slice(0, 200)}` : ''}`);
  }
  const body = await res.json().catch(() => null);
  const eventId = body?.job_id;
  if (!eventId) throw new Error('Nova accepted the request but returned no job id');
  return { eventId };
}

/**
 * Ask the engine about one job. Returns 'processing' while it is queued or
 * rendering, 'completed' with the MP4 URL when it lands, or 'failed' with the
 * engine's own message. An unreachable engine is reported as processing, never
 * as failure — a sleeping or restarting Space must not write off a render whose
 * record is sitting on disk.
 */
export async function pollNovaEvent(eventId: string) {
  const pending = { status: 'processing', videoUrl: '', detail: '', error: '' };
  let body: any = null;
  try {
    const res = await fetch(`${ENGINE_BASE}/nova/job/${eventId}`, {
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
    });
    if (res.status === 404) {
      return { ...pending, status: 'failed', error: 'Nova lost this render — the engine restarted before it finished.' };
    }
    if (!res.ok) return pending;
    body = await res.json();
  } catch {
    return pending;
  }

  if (body?.status === 'completed') {
    const videoUrl = body.video_url ? `${ENGINE_BASE}${body.video_url}` : '';
    if (!videoUrl) return { ...pending, status: 'failed', error: 'Nova finished but returned no video file' };
    return { status: 'completed', videoUrl, detail: String(body.report || ''), error: '' };
  }
  if (body?.status === 'failed') {
    return { ...pending, status: 'failed', error: String(body.error || 'Nova render failed').slice(0, 300) };
  }
  return pending;
}

/**
 * Copy the finished MP4 into our own storage. A Space output URL is not a file
 * of record — it dies with the worker — so nothing hf.space-hosted may ever
 * reach a creator's library.
 */
export async function persistNovaVideo(base44, videoUrl: string, name: string) {
  if (!isNovaOutputUrl(videoUrl)) throw new Error('Refusing to persist a file that did not come from the Nova engine');
  const f = await fetch(videoUrl, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!f.ok) throw new Error(`Nova output fetch HTTP ${f.status}`);
  const blob = await f.blob();
  if (blob.size < 20000) throw new Error('Nova output too small to be a video');
  const safe = (name || 'nova').replace(/[^\w.\-]/g, '_').slice(0, 60) || 'nova';
  const file = new File([blob], `${safe}.mp4`, { type: 'video/mp4' });
  const up = await base44.integrations.Core.UploadFile({ file });
  if (!up?.file_url) throw new Error('Nova output could not be persisted');
  return { fileUrl: up.file_url, bytes: blob.size };
}

// Credit balance (service-role read).
export async function novaBalance(base44, userId: string) {
  const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: userId });
  return { record: recs[0] || null, balance: recs[0]?.balance ?? 0 };
}

// Deduct on completion only — a render that never produced a file is free.
export async function novaDeduct(base44, user, amount: number, jobId: string) {
  const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
  const record = recs[0];
  if (!record) return 0;
  const newBalance = Math.max(0, (record.balance || 0) - amount);
  await base44.asServiceRole.entities.UserCredit.update(record.id, {
    balance: newBalance,
    lifetime_spent: (record.lifetime_spent || 0) + amount,
    monthly_used: (record.monthly_used || 0) + amount,
  });
  await base44.asServiceRole.entities.CreditLog.create({
    user_id: user.id, user_email: user.email,
    transaction_type: 'generation',
    amount: -amount,
    balance_before: record.balance,
    balance_after: newBalance,
    related_job_id: jobId, provider: 'novah3',
    description: 'Nova (MiniMax-H3) video generation',
  }).catch(() => {});
  return newBalance;
}