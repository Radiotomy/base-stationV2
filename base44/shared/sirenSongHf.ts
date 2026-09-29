// Siren Song (HeartMuLa 3B) — our audio generation engine, hosted on a Hugging
// Face Space (huggingface.co/spaces/Radiotomy/Sirens-Song). Async submit-and-poll,
// the same shape as the private LTX video engine.
//
//   POST /generate/audio  { tags, lyrics, max_audio_length_ms, seed }
//        → { status: "accepted", job_id }
//   GET  /status/{job_id}
//        → { status: pending|processing|completed|failed, progress, download_url? }
//   GET  {BASE}{download_url}
//        → the rendered WAV (48kHz float PCM — the model's native output)
//
// This is NOT a prose-prompt model. It has exactly two conditioning channels:
//   tags   — comma-separated tokens, no spaces after commas (e.g. 'red,dirt,country,acoustic')
//   lyrics — plain text with bracketed section headers ([Verse], [Chorus], …)
// A descriptive sentence in the tags channel is a misuse of the interface.

import { ensureAwake } from './hfWake.ts';
const ENGINE_BASE = 'https://radiotomy-sirens-song.hf.space';

const SUBMIT_TIMEOUT_MS = 30000;
const STATUS_TIMEOUT_MS = 15000;
// A 48kHz float WAV of up to a minute is a large fetch — give the download room.
const DOWNLOAD_TIMEOUT_MS = 120000;

// Cost of one Siren Song generation, in credits. Sits between Harmonix Pro (10)
// and Vault (15): comparable inference budget, no watermarking pipeline.
export const SIREN_SONG_COST = 12;

// Submit a job. Throws on any transport or contract failure so the caller can
// surface a clean 502 — a submit that half-succeeds must never look accepted.
export async function submitSirenSongAudio({ tags, lyrics, maxMs, seed }) {
  const instrumental = !(lyrics && lyrics.trim());
  // '[instrumental]' in the lyric channel alone does NOT stop HeartMuLa singing —
  // probe A-instrumental-seed42 came back with improvised non-English vocals.
  // The style channel is what the model actually steers on, so an instrumental
  // request must also carry the 'instrumental' tag.
  const tagList = String(tags).split(',').map(t => t.trim()).filter(Boolean);
  if (instrumental && !tagList.includes('instrumental')) tagList.unshift('instrumental');
  await ensureAwake(ENGINE_BASE);
  const res = await fetch(`${ENGINE_BASE}/generate/audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tags: tagList.join(','),
      lyrics: instrumental ? '[instrumental]' : lyrics,
      max_audio_length_ms: maxMs,
      seed,
    }),
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Siren Song engine HTTP ${res.status}${t ? `: ${t.slice(0, 200)}` : ''}`);
  }
  const data = await res.json().catch(() => null);
  const jobId = data?.job_id;
  if (!jobId) throw new Error('Siren Song accepted the request but returned no job_id');
  return { jobId };
}

// One status read. Normalizes the engine's field names into a stable shape.
export async function getSirenSongStatus(jobId) {
  const res = await fetch(`${ENGINE_BASE}/status/${jobId}`, {
    signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
  });
  // In-memory job state on the Space: a restart erases the job and its rendered
  // file, so a 404 is TERMINAL. Treating it as transient is what left the studio
  // polling a dead id indefinitely.
  if (res.status === 404) return { status: 'lost', progress: '', error: '', downloadUrl: '' };
  if (!res.ok) throw new Error(`Siren Song status HTTP ${res.status}`);
  const data = await res.json().catch(() => null);
  if (!data) throw new Error('Siren Song status returned no body');
  return {
    status: String(data.status || '').toLowerCase(),
    progress: data.progress || '',
    error: data.error || '',
    downloadUrl: String(data.download_url || data.file_url || data.url || ''),
  };
}

// Fetch the finished WAV and copy it into Base44 storage immediately: Space
// storage is ephemeral, so an hf.space link must never be handed to the player.
export async function persistSirenSongWav(base44, downloadUrl, name) {
  const url = /^https?:/i.test(downloadUrl)
    ? downloadUrl
    : `${ENGINE_BASE}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
  const f = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!f.ok) throw new Error(`Siren Song output fetch HTTP ${f.status}`);
  const blob = await f.blob();
  if (blob.size < 10000) throw new Error('Siren Song output too small to be audio');
  const safeName = (name || 'siren-song').replace(/[^\w.\-]/g, '_').slice(0, 60) || 'siren-song';
  const file = new File([blob], `${safeName}.wav`, { type: 'audio/wav' });
  const up = await base44.integrations.Core.UploadFile({ file });
  if (!up?.file_url) throw new Error('Siren Song output could not be persisted');
  return up.file_url;
}

// Current credit balance (service-role read).
export async function sirenBalance(base44, userId) {
  const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: userId });
  return { record: recs[0] || null, balance: recs[0]?.balance ?? 0 };
}

// Deduct on completion — never on submit — so a job that never renders is free.
export async function sirenDeduct(base44, user, amount, jobId) {
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
    related_job_id: jobId, provider: 'sirensong',
    description: 'Siren Song audio generation',
  }).catch(() => {});
  return newBalance;
}