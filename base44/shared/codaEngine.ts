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

// Submit a job. Throws on any transport or contract failure so the caller can
// surface a clean 502.
export async function submitCodaGeneration({ tags, lyrics, maxMs, seed }) {
  let res;
  try {
    res = await fetch(`${CODA_BASE_URL}/generate/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tags,
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

// The engine returns /outputs/… paths — resolve them against the Space host.
export function codaAbsoluteUrl(downloadUrl) {
  return /^https?:/i.test(downloadUrl)
    ? downloadUrl
    : `${CODA_BASE_URL}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
}