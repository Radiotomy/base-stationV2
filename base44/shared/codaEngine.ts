// Coda — BASE-Harmonix's engine backend: ACE-Step 1.5 XL Turbo (4B DiT
// architecture), self-hosted on our Hugging Face Space (Radiotomy/Coda).
// Replaces the retired Replicate deployment (fishaudio/ace-step-1.5).
//
// Async submit-and-poll, same contract as the Siren Song engine:
//   POST /generate/audio  { tags, lyrics, max_audio_length_ms, seed }
//        → { status: "accepted", job_id }
//   GET  /status/{job_id}
//        → { status: pending|processing|completed|failed, progress, download_url? }
//   GET  {BASE}{download_url} → the rendered WAV
//
// HYPERPARAMETERS ARE FIXED BY THE ENGINE and must never be made configurable:
//   num_inference_steps = 8   (distillation-accelerated XL Turbo)
//   guidance_scale      = 1.0 (CFG disabled — any other value collapses the audio)
// They are recorded on jobs for provenance but never sent or overridden.
//
// Conditioning contract:
//   Instrumental — tags carry genre/instrumentation/mood; lyrics is exactly
//                  '[instrumental]' so the full 4B DiT budget goes to the bed.
//   Vocal        — lyrics carries ACE-Step's lowercase structure tags
//                  ([verse], [chorus], [bridge], [outro], …) — see
//                  src/utils/aceStepLyrics.js for the normalization grammar.

export const CODA_BASE_URL = 'https://radiotomy-coda.hf.space';
export const CODA_MODEL_VERSION = 'Coda (ACE-Step 1.5 XL Turbo · 4B DiT)';
export const CODA_FIXED_PARAMS = { num_inference_steps: 8, guidance_scale: 1.0 };

// The first submission after the Space idles triggers lazy-loaded model
// initialization — give the warm-up room before declaring the engine down.
const SUBMIT_TIMEOUT_MS = 90000;
const STATUS_TIMEOUT_MS = 15000;

// Production steer appended to every Coda tags string. The 2026-09-01 vocal
// test (seed 9002) came back excellent but slightly soft on top; ACE-Step reads
// tonal descriptors from the tags channel, so a light "air" hint is the lever.
// Deliberately gentle — "crisp/airy", not "bright/harsh" — to lift the top a tad
// without tipping the balance we already like.
export const CODA_TONE_HINT = 'crisp airy high end, clear detailed treble, polished master';

// Submit a job. Throws on any transport or contract failure so the caller can
// surface a clean 502.
export async function submitCodaGeneration({ tags, lyrics, maxMs, seed }) {
  let res;
  try {
    res = await fetch(`${CODA_BASE_URL}/generate/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tags: `${String(tags).trim().replace(/[,\s]+$/, '')}, ${CODA_TONE_HINT}`,
        lyrics: lyrics && lyrics.trim() ? lyrics : '[instrumental]',
        max_audio_length_ms: maxMs || 30000,
        seed: seed || 42,
      }),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    });
  } catch (e) {
    throw new Error(`Coda engine unreachable (it may be warming up — try again in a minute): ${e.message}`);
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Coda engine HTTP ${res.status}${t ? `: ${t.slice(0, 200)}` : ''}`);
  }
  const data = await res.json().catch(() => null);
  const jobId = data?.job_id;
  if (!jobId) throw new Error('Coda accepted the request but returned no job_id');
  return { jobId };
}

// One status read. Normalizes the engine's field names into a stable shape.
export async function getCodaStatus(jobId) {
  const res = await fetch(`${CODA_BASE_URL}/status/${jobId}`, {
    signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Coda status HTTP ${res.status}`);
  const data = await res.json().catch(() => null);
  if (!data) throw new Error('Coda status returned no body');
  return {
    status: String(data.status || '').toLowerCase(),
    progress: data.progress || '',
    error: data.error || '',
    downloadUrl: String(data.download_url || data.file_url || data.url || ''),
  };
}

// ── Edit tasks (Phase 2 of the Coda engine) ─────────────────────────────────
// The same loaded ACE-Step 1.5 pipeline natively supports audio-to-audio task
// modes; the Space's /generate/audio route accepts them since engine v1.1.
// All tasks condition on a SOURCE audio URL the Space downloads itself
// (WAV/FLAC — the libsndfile path; MP3 sources are not guaranteed).
export const CODA_EDIT_COST = 10;
export const CODA_EDIT_TASKS = ['cover', 'repaint', 'extract'];

// Submit an edit-task job. Same accept contract as submitCodaGeneration.
export async function submitCodaEdit({
  task, srcAudioUrl, tags, lyrics, refAudioUrl,
  repaintStart, repaintEnd, coverStrength, trackName, seed,
}) {
  const body: Record<string, unknown> = {
    task_type: task,
    src_audio_url: srcAudioUrl,
    tags: tags || '',
    lyrics: lyrics && lyrics.trim() ? lyrics : '[instrumental]',
    seed: seed || 42,
  };
  if (refAudioUrl) body.ref_audio_url = refAudioUrl;
  if (repaintStart !== undefined && repaintStart !== null) body.repainting_start = repaintStart;
  if (repaintEnd !== undefined && repaintEnd !== null) body.repainting_end = repaintEnd;
  if (task === 'cover' && coverStrength !== undefined) {
    body.audio_cover_strength = Math.max(0, Math.min(Number(coverStrength), 1));
  }
  if (trackName) body.track_name = String(trackName).slice(0, 40);

  let res;
  try {
    res = await fetch(`${CODA_BASE_URL}/generate/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    });
  } catch (e) {
    throw new Error(`Coda engine unreachable (it may be warming up — try again in a minute): ${e.message}`);
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Coda engine HTTP ${res.status}${t ? `: ${t.slice(0, 200)}` : ''}`);
  }
  const data = await res.json().catch(() => null);
  const jobId = data?.job_id;
  if (!jobId) throw new Error('Coda accepted the request but returned no job_id');
  return { jobId };
}

// The engine returns /outputs/… paths — resolve them against the Space host.
export function codaAbsoluteUrl(downloadUrl) {
  return /^https?:/i.test(downloadUrl)
    ? downloadUrl
    : `${CODA_BASE_URL}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
}