// Private RunPod A100 LTX engine — PRIMARY video engine for text-to-video.
//
// The pod is SYNCHRONOUS (one POST returns when the MP4 is rendered) and
// fixed-format: 768x512, 97 frames @ 24fps, 40 inference steps. It can be
// asleep, busy, or gone entirely — so every failure path here returns null,
// and the caller falls through silently to the public LTX API. This function
// must NEVER throw: an exception would fail the whole generation instead of
// triggering the fallback the routing exists for.
//
// Expected pod response: {"status": "success", "file_path": "...", "filename": "..."}
// That is a path on the pod, not a URL — the actual MP4 location isn't
// documented, so retrieval tries the common serving conventions in order and
// treats "none fetchable" as a private-engine failure (→ public fallback).
// The fetched bytes are uploaded into Base44 storage immediately: pods are
// ephemeral, so a proxy.runpod.net link must never be handed to the player.

const RUNPOD_BASE = 'https://ka9byhua0n7657-8000.proxy.runpod.net';

// Rendering 97 frames at 40 steps runs ~1-2 minutes on a warm A100. Past this
// ceiling the pod is treated as unavailable and the public engine takes over.
const GENERATE_TIMEOUT_MS = 120000;
const DOWNLOAD_TIMEOUT_MS = 60000;

export async function tryRunpodPrivateVideo(base44, { prompt, seed }) {
  try {
    const usedSeed = Number.isFinite(Number(seed)) ? Number(seed) : 42;

    const res = await fetch(`${RUNPOD_BASE}/generate/video`, {
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
      signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`RunPod private engine HTTP ${res.status} — falling back to public LTX`);
      return null;
    }
    const data = await res.json().catch(() => null);
    if (data?.status !== 'success') {
      console.warn('RunPod private engine returned non-success — falling back to public LTX');
      return null;
    }

    const filePath = String(data.file_path || '');
    const filename = String(data.filename || filePath.split('/').pop() || 'video.mp4');
    const candidates = [
      data.video_url, data.url, data.file_url,
      /^https?:/i.test(filePath) ? filePath : null,
      filePath.startsWith('/') ? `${RUNPOD_BASE}${filePath}` : null,
      `${RUNPOD_BASE}/videos/${filename}`,
      `${RUNPOD_BASE}/download/${filename}`,
      `${RUNPOD_BASE}/outputs/${filename}`,
    ].filter(Boolean);

    for (const url of candidates) {
      try {
        const f = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
        if (!f.ok) continue;
        const blob = await f.blob();
        if (blob.size < 10000) continue; // an error page or JSON, not a video
        const file = new File([blob], filename.replace(/[^\w.\-]/g, '_'), { type: 'video/mp4' });
        const up = await base44.integrations.Core.UploadFile({ file });
        if (up?.file_url) return { video_url: up.file_url, seed: usedSeed };
      } catch { /* try the next serving convention */ }
    }

    console.warn('RunPod generated but no output URL was fetchable — falling back to public LTX');
    return null;
  } catch (e) {
    console.warn('RunPod private engine unavailable — falling back to public LTX:', e.message);
    return null;
  }
}