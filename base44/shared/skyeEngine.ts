// Skye — our open-source fork of DiffRhythm 2, self-hosted on a Hugging Face
// Space (huggingface.co/spaces/Radiotomy/Skye). Async submit-and-poll, the same
// architectural shape as Siren Song and Coda, but a COMPLETELY different model
// with a different conditioning contract.
//
//   POST /generate/audio  { lyrics, style_prompt, negative_style_prompt,
//                           reference_audio_url, duration, seed }
//        → { status: "accepted", job_id }
//   GET  /status/{job_id}
//        → { status: pending|processing|completed|failed, progress,
//            download_url?, filename?, file_path? }
//   GET  {BASE}{download_url}
//        → the rendered WAV
//
// Conditioning notes that drive the UI and the sanitizing below:
//   style_prompt          — PROSE, not comma tokens. DiffRhythm 2 steers on a
//                           natural-language description of the production.
//                           (This is the opposite of Siren Song's tag channel —
//                           feeding tags here wastes the model's text encoder.)
//   negative_style_prompt — what to steer AWAY from. Distinct channel, so a
//                           creator never has to phrase a negative as a positive.
//   lyrics                — raw OR LRC-timestamped ("[00:12.50] line"). The fork
//                           does phonetic alignment, so timestamps are optional
//                           and are passed through untouched when present.
//   reference_audio_url   — zero-shot style cloning. The Space downloads the URL
//                           itself and cleans up its own temp file, so we only
//                           ever hand it a public https URL, never file bytes.

const ENGINE_BASE = 'https://radiotomy-skye.hf.space';

// Generous, because a Space that has scaled to zero (or just had its GPU
// changed) has to cold-start before it can even acknowledge a submit. A tight
// timeout here reports "engine down" for a Space that was merely waking up.
const SUBMIT_TIMEOUT_MS = 90000;
const STATUS_TIMEOUT_MS = 15000;
// Long-form output means a much larger WAV than Siren Song's 60s ceiling.
const DOWNLOAD_TIMEOUT_MS = 180000;

// Hard ceiling of the fork's long-form window, in seconds.
export const SKYE_MAX_DURATION = 285;
export const SKYE_DEFAULT_DURATION = 95;

// Cost of one Skye generation, in credits. Above Siren Song (12) because the
// long-form window is nearly 5x the GPU time for a full-length render.
export const SKYE_COST = 14;

// What the model should steer away from unless the creator says otherwise.
// Sent as a real default rather than left blank: an empty negative channel is a
// wasted conditioning input on a model that has one.
export const SKYE_DEFAULT_NEGATIVE =
  'low quality, distorted, muffled, amateur recording, artifacts';

// Submit a job. Throws on any transport or contract failure so the caller can
// surface a clean 502 — a submit that half-succeeds must never look accepted.
export async function submitSkyeAudio({
  lyrics, stylePrompt, negativeStylePrompt, referenceAudioUrl, duration, seed,
}) {
  const body: Record<string, unknown> = {
    lyrics: lyrics && lyrics.trim() ? lyrics : '[instrumental]',
    style_prompt: stylePrompt,
    negative_style_prompt: negativeStylePrompt || SKYE_DEFAULT_NEGATIVE,
    duration,
    seed,
  };
  // Only sent when actually supplied — an empty string would make the Space
  // attempt a download of nothing and fail a job that needed no reference.
  if (referenceAudioUrl) body.reference_audio_url = referenceAudioUrl;

  const res = await fetch(`${ENGINE_BASE}/generate/audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Skye engine HTTP ${res.status}${t ? `: ${t.slice(0, 200)}` : ''}`);
  }
  const data = await res.json().catch(() => null);
  const jobId = data?.job_id;
  if (!jobId) throw new Error('Skye accepted the request but returned no job_id');
  return { jobId };
}

// One status read. Normalizes the engine's field names into a stable shape.
export async function getSkyeStatus(jobId) {
  const res = await fetch(`${ENGINE_BASE}/status/${jobId}`, {
    signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Skye status HTTP ${res.status}`);
  const data = await res.json().catch(() => null);
  if (!data) throw new Error('Skye status returned no body');
  return {
    status: String(data.status || '').toLowerCase(),
    progress: data.progress || '',
    error: data.error || '',
    // file_path is a path INSIDE the Space container and is never fetchable from
    // here, so it is deliberately not treated as a download candidate.
    downloadUrl: String(data.download_url || data.file_url || data.url || ''),
    filename: String(data.filename || ''),
  };
}

// Read the format block out of a RIFF/WAVE header. The sample rate is
// load-bearing for BASE Mark: the V2 detector currently cannot recover a mark
// from a 48kHz master, so whether a track may be watermarked is decided by the
// MEASURED rate rather than an assumption about what the model emits. Returns
// nulls for anything that isn't a WAVE container instead of throwing — an
// unreadable header must not fail a render that already succeeded.
export function readWavFormat(bytes: Uint8Array) {
  try {
    if (bytes.length < 44) return { sampleRate: null, channels: null, bitDepth: null };
    const tag = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return { sampleRate: null, channels: null, bitDepth: null };
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return {
      channels: dv.getUint16(22, true),
      sampleRate: dv.getUint32(24, true),
      bitDepth: dv.getUint16(34, true),
    };
  } catch {
    return { sampleRate: null, channels: null, bitDepth: null };
  }
}

// Fetch the finished WAV and copy it into Base44 storage immediately: Space
// storage is ephemeral, so an hf.space link must never be handed to the player.
// Returns the stored URL plus the measured format, so the caller never has to
// assume the engine's output rate.
export async function persistSkyeWav(base44, downloadUrl, name) {
  const url = /^https?:/i.test(downloadUrl)
    ? downloadUrl
    : `${ENGINE_BASE}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
  const f = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!f.ok) throw new Error(`Skye output fetch HTTP ${f.status}`);
  const blob = await f.blob();
  if (blob.size < 10000) throw new Error('Skye output too small to be audio');
  const safeName = (name || 'skye').replace(/[^\w.\-]/g, '_').slice(0, 60) || 'skye';
  const buf = new Uint8Array(await blob.arrayBuffer());
  const format = readWavFormat(buf);
  const file = new File([buf], `${safeName}.wav`, { type: 'audio/wav' });
  const up = await base44.integrations.Core.UploadFile({ file });
  if (!up?.file_url) throw new Error('Skye output could not be persisted');
  return { fileUrl: up.file_url, ...format };
}

// Current credit balance (service-role read).
export async function skyeBalance(base44, userId) {
  const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: userId });
  return { record: recs[0] || null, balance: recs[0]?.balance ?? 0 };
}

// Deduct on completion — never on submit — so a job that never renders is free.
export async function skyeDeduct(base44, user, amount, jobId) {
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
    related_job_id: jobId, provider: 'skye',
    description: 'Skye (DiffRhythm 2) audio generation',
  }).catch(() => {});
  return newBalance;
}