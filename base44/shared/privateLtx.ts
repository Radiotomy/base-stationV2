// Private LTX engine — PRIMARY video engine for text-to-video, hosted on a
// Hugging Face Space (moved off RunPod: its proxy killed any HTTP request at
// ~100s with a 524, which no client-side timeout could survive).
//
// The engine is ASYNC (submit-and-poll), fixed-format: 768x512, 97 frames
// @ 24fps, 40 inference steps.
//   POST /generate/video          → { job_id }         (returns immediately)
//   GET  /status/{job_id}         → { status, download_url? }  status: "completed" when done
//   GET  {BASE}{download_url}     → the rendered MP4
//
// The Space can be asleep, busy, or gone entirely — so every failure path here
// returns null, and the caller falls through silently to the public LTX API.
// This function must NEVER throw: an exception would fail the whole generation
// instead of triggering the fallback the routing exists for.
//
// The fetched bytes are uploaded into Base44 storage immediately: Space
// storage is ephemeral, so an hf.space link must never be handed to the player.

const ENGINE_BASE = 'https://radiotomy-basestation-ltx-engine.hf.space';

const SUBMIT_TIMEOUT_MS = 30000;
const POLL_INTERVAL_MS = 5000;
// Rendering 97 frames at 40 steps runs well under a minute on a warm GPU, but
// a cold Space adds model-load time. Past this ceiling the engine is treated
// as unavailable and the public engine takes over.
const POLL_DEADLINE_MS = 300000;
const DOWNLOAD_TIMEOUT_MS = 60000;

export async function tryPrivateLtxVideo(base44, { prompt, seed }) {
  try {
    const usedSeed = Number.isFinite(Number(seed)) ? Number(seed) : 42;

    // ── Submit ──────────────────────────────────────────────────────────────
    const res = await fetch(`${ENGINE_BASE}/generate/video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        negative_prompt: 'worst quality, inconsistent motion, blurry, jittery',
        num_inference_steps: 40,
        width: 768,
        height: 512,
        num_frames: 97,
        fps: 24,
        seed: usedSeed,
      }),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`Private LTX engine HTTP ${res.status} on submit — falling back to public LTX`);
      return null;
    }
    const submitted = await res.json().catch(() => null);
    const jobId = submitted?.job_id;
    if (!jobId) {
      console.warn('Private LTX engine returned no job_id — falling back to public LTX');
      return null;
    }

    // ── Poll ────────────────────────────────────────────────────────────────
    const deadline = Date.now() + POLL_DEADLINE_MS;
    let downloadUrl = null;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      let status: any = null;
      try {
        const s = await fetch(`${ENGINE_BASE}/status/${jobId}`, {
          signal: AbortSignal.timeout(15000),
        });
        if (!s.ok) continue; // transient — keep polling until the deadline
        status = await s.json().catch(() => null);
      } catch { continue; }

      const state = String(status?.status || '').toLowerCase();
      if (state === 'completed') {
        downloadUrl = String(status.download_url || status.file_url || status.url || '');
        break;
      }
      if (state === 'failed' || state === 'error') {
        console.warn(`Private LTX job ${jobId} failed: ${status?.error || 'no detail'} — falling back to public LTX`);
        return null;
      }
      // pending / processing → keep polling
    }

    if (!downloadUrl) {
      console.warn(`Private LTX job ${jobId} did not complete within ${POLL_DEADLINE_MS / 1000}s — falling back to public LTX`);
      return null;
    }

    // ── Fetch + persist ─────────────────────────────────────────────────────
    const url = /^https?:/i.test(downloadUrl)
      ? downloadUrl
      : `${ENGINE_BASE}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
    const filename = (url.split('/').pop() || 'video.mp4').replace(/[^\w.\-]/g, '_');

    const f = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!f.ok) {
      console.warn(`Private LTX output fetch HTTP ${f.status} — falling back to public LTX`);
      return null;
    }
    const blob = await f.blob();
    if (blob.size < 10000) {
      console.warn('Private LTX output too small to be a video — falling back to public LTX');
      return null;
    }
    const file = new File([blob], filename, { type: 'video/mp4' });
    const up = await base44.integrations.Core.UploadFile({ file });
    if (up?.file_url) return { video_url: up.file_url, seed: usedSeed };

    console.warn('Private LTX output could not be persisted — falling back to public LTX');
    return null;
  } catch (e) {
    console.warn('Private LTX engine unavailable — falling back to public LTX:', e.message);
    return null;
  }
}