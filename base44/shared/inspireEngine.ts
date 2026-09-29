// Inspire — our in-house engine built on InspireMusic (FunAudioLLM /
// QwenAudio-FunMusic, Apache-2.0), self-hosted on our own Hugging Face Space.
// Architecture: an audio tokenizer feeding a Qwen2.5-backbone autoregressive
// transformer, then a flow-matching SUPER-RESOLUTION stage that lifts the
// generated 24kHz token stream to a 48kHz waveform before the vocoder.
//
// Honest positioning (measured 2026-09): the file is a 48kHz container, but the
// model emits MONO (upstream duplicates it to both channels) and carries very
// little content above ~6kHz — the super-resolution stage raises the rate, not
// the detail. It is a sketch / continuation engine, not a finished-master source;
// UI copy must never claim otherwise. What it genuinely offers:
//   • Music CONTINUATION — it is the only engine that accepts an audio prompt and
//     keeps composing FROM it. That makes it the one engine that can extend a
//     creator's own existing recording rather than starting from nothing, which
//     is also why an Inspire continuation is 'ai_assisted', never 'ai_generated'.
//   • Section conditioning (intro/verse/chorus/outro) — the creator states which
//     part of an arrangement they want, so it is usable as a section factory for
//     SUB-Station, not only as a one-shot song generator.
//
// It is INSTRUMENTAL. Upstream ships no lyric or vocal channel at all (the
// InspireSong vocal model was never released), so the UI must not offer a lyric
// field — a lyric box the model silently discards is worse than no box.
//
// Space contract (ours, persistence-first like every other BASE engine):
//   POST /generate { task, text, audio_prompt_url, chorus, duration,
//                    sample_rate, model, seed } → { task_id, status }
//   GET  /status/{task_id} → { status: queued|processing|completed|failed,
//                              progress, result_url, error }
//   GET  {BASE}{result_url} → the rendered WAV
//
// The audio prompt is passed as a public URL, never as bytes: the Space fetches
// and trims it itself (upstream caps the prompt at 5s), which keeps the render
// request small and keeps the prompt out of this function's memory.

import { readWavFormat } from './skyeEngine.ts';

// Overridable so the Space can be moved or duplicated without a code change.
import { ensureAwake } from './hfWake.ts';
const ENGINE_BASE = (Deno.env.get('INSPIRE_ENGINE_URL') || 'https://radiotomy-inspire.hf.space')
  .replace(/\/+$/, '');

// A Space that has scaled to zero must cold-start before it can even acknowledge
// a submit, so the submit window is generous while status reads stay tight.
const SUBMIT_TIMEOUT_MS = 90000;
const STATUS_TIMEOUT_MS = 15000;
// 300s of 48kHz stereo WAV is ~110MB — the download needs real headroom.
const DOWNLOAD_TIMEOUT_MS = 240000;

// Upstream's validated window: the CLI refuses below 10s and the released
// checkpoints are trained for long-form up to 300s.
export const INSPIRE_MIN_DURATION = 10;
export const INSPIRE_MAX_DURATION = 300;
export const INSPIRE_DEFAULT_DURATION = 60;

// Credits per render. Between Siren Song (12) and Skye (14): the AR pass is
// cheap, but the 48kHz flow-matching super-resolution stage is not, and it runs
// over the whole clip.
export const INSPIRE_COST = 13;

// The only checkpoints worth exposing. 1.5B-Long is the sole one trained for
// multi-minute coherence; 1.5B is sharper on short pieces; the 24kHz variants
// skip flow matching entirely, which is a real speed/quality trade rather than
// just a lower rate, so the choice is surfaced honestly.
export const INSPIRE_MODELS = [
  { id: 'InspireMusic-1.5B-Long', label: 'Long-form (1.5B)', sampleRate: 48000, maxDuration: 300 },
  { id: 'InspireMusic-1.5B', label: 'Standard (1.5B)', sampleRate: 48000, maxDuration: 90 },
  { id: 'InspireMusic-Base', label: 'Base', sampleRate: 48000, maxDuration: 90 },
  { id: 'InspireMusic-1.5B-24kHz', label: 'Fast draft (1.5B, 24kHz)', sampleRate: 24000, maxDuration: 90 },
];
export const INSPIRE_DEFAULT_MODEL = 'InspireMusic-1.5B-Long';

// Arrangement section the render should sound like. Upstream calls this the
// "chorus mode" and it is a genuine conditioning token, not a text hint.
export const INSPIRE_SECTIONS = ['intro', 'verse', 'chorus', 'outro'];

export function resolveInspireModel(id?: string) {
  return INSPIRE_MODELS.find(m => m.id === id) || INSPIRE_MODELS[0];
}

// Upstream is English-prompt only and reads a natural-language DESCRIPTION of the
// production, so a comma tag list wastes the text encoder. Reminding the model
// the piece is instrumental is load-bearing: without it the AR stage sometimes
// emits vocal-like formants it has no vocoder path to resolve cleanly.
export const INSPIRE_INSTRUMENTAL_HINT = 'purely instrumental with no vocals';

export async function submitInspireJob({
  task, text, audioPromptUrl, section, duration, model, seed,
}: {
  task: 'text-to-music' | 'continuation';
  text: string;
  audioPromptUrl?: string;
  section: string;
  duration: number;
  model: string;
  seed?: number;
}) {
  await ensureAwake(ENGINE_BASE);
  const res = await fetch(`${ENGINE_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task,
      text,
      audio_prompt_url: audioPromptUrl || '',
      chorus: section,
      duration,
      model,
      sample_rate: resolveInspireModel(model).sampleRate,
      seed,
    }),
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Inspire engine HTTP ${res.status}${t ? `: ${t.slice(0, 200)}` : ''}`);
  }
  const data = await res.json().catch(() => null);
  const jobId = data?.task_id || data?.job_id;
  if (!jobId) throw new Error('Inspire accepted the request but returned no task_id');
  return { jobId };
}

export async function getInspireStatus(jobId: string) {
  const res = await fetch(`${ENGINE_BASE}/status/${jobId}`, {
    signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Inspire status HTTP ${res.status}`);
  const data = await res.json().catch(() => null);
  if (!data) throw new Error('Inspire status returned no body');
  return {
    status: String(data.status || '').toLowerCase(),
    progress: data.progress || '',
    error: data.error || '',
    downloadUrl: String(data.result_url || data.download_url || data.url || ''),
  };
}

// Peak amplitude of a 16-bit PCM WAV. 0 = digital silence, which the Space can
// report as 'completed' when the model loaded but never ran — persisting that
// would charge the creator for silence and feed silence to BASE Mark. null when
// the container isn't 16-bit PCM, so an unmeasurable file is never called silent.
function wavPeak(bytes: Uint8Array): number | null {
  try {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    if (bytes.length < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
    let off = 12, dataOff = -1, dataSize = 0, bits = 0;
    while (off + 8 <= bytes.length) {
      const id = tag(off), sz = dv.getUint32(off + 4, true);
      if (id === 'fmt ') bits = dv.getUint16(off + 22, true);
      if (id === 'data') { dataOff = off + 8; dataSize = sz; break; }
      off += 8 + sz + (sz % 2);
    }
    if (dataOff < 0 || bits !== 16) return null;
    const end = Math.min(dataOff + dataSize, bytes.length);
    let peak = 0;
    for (let i = dataOff; i + 1 < end; i += 2) {
      const v = Math.abs(dv.getInt16(i, true));
      if (v > peak) peak = v;
    }
    return peak;
  } catch {
    return null;
  }
}

// Copy the finished WAV into Base44 storage immediately — Space storage is
// ephemeral, so an hf.space URL must never reach the player or the library.
// Returns the stored URL plus the MEASURED format: the rate is read from the
// file rather than assumed from the chosen model, because that is what the
// mastering, stem and BASE Mark paths downstream act on.
export async function persistInspireWav(base44, downloadUrl: string, name: string, requestedDuration = 0) {
  const url = /^https?:/i.test(downloadUrl)
    ? downloadUrl
    : `${ENGINE_BASE}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
  const f = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!f.ok) throw new Error(`Inspire output fetch HTTP ${f.status}`);
  const blob = await f.blob();
  if (blob.size < 10000) throw new Error('Inspire output too small to be audio');
  const buf = new Uint8Array(await blob.arrayBuffer());
  const format = readWavFormat(buf);

  if (wavPeak(buf) === 0) {
    throw new Error('Inspire returned a silent file — the engine reported success but rendered no audio.');
  }
  if (format.sampleRate && format.channels && format.bitDepth) {
    const frameBytes = format.channels * (format.bitDepth / 8);
    const seconds = (format.dataBytes ?? Math.max(0, buf.length - 44)) / frameBytes / format.sampleRate;
    if (requestedDuration > 0 && seconds < Math.min(8, requestedDuration * 0.5)) {
      throw new Error(`Inspire returned ${seconds.toFixed(1)}s of audio for a ${requestedDuration}s request — the engine did not perform a full render.`);
    }
  }

  const safeName = (name || 'inspire').replace(/[^\w.\-]/g, '_').slice(0, 60) || 'inspire';
  const file = new File([buf], `${safeName}.wav`, { type: 'audio/wav' });
  const up = await base44.integrations.Core.UploadFile({ file });
  if (!up?.file_url) throw new Error('Inspire output could not be persisted');
  return { fileUrl: up.file_url, ...format };
}

export async function inspireBalance(base44, userId: string) {
  const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: userId });
  return { record: recs[0] || null, balance: recs[0]?.balance ?? 0 };
}

// Deducted on completion only — a job that never renders is free.
export async function inspireDeduct(base44, user, amount: number, jobId: string) {
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
    related_job_id: jobId, provider: 'inspire',
    description: 'Inspire (InspireMusic) instrumental generation',
  }).catch(() => {});
  return newBalance;
}