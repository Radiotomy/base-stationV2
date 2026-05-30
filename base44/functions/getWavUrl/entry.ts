import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Fetches a high-quality WAV (or MP3) download URL for an aimusicapi clip on-demand.
 *
 * Sonic flow (sync):
 *   POST /api/v1/sonic/wav  { clip_id }  →  { data: { wav_url } }
 *   Free — returns immediately.
 *
 * Producer flow (async, 2 credits, auto-refunded on failure):
 *   POST /api/v1/producer/download  { clip_id, format: 'mp3'|'wav' } → { task_id }
 *   Then poll GET /api/v1/producer/task/{task_id} for the audio_url / wav_url.
 *   We poll inline (up to ~20s) so the client gets a single response.
 *
 * Payload: { clip_id, provider?: 'sonic'|'producer' (default 'sonic'), format?: 'wav'|'mp3' (Producer only, default 'wav') }
 * Returns: { wav_url } for Sonic, { wav_url? , audio_url? } for Producer.
 */

const AI_BASE = 'https://api.aimusicapi.ai/api/v1';
const SONIC_API_KEY = Deno.env.get('SONIC_API_KEY');
const PRODUCER_API_KEY = SONIC_API_KEY; // shared aimusicapi key

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { clip_id, provider = 'sonic', format = 'wav' } = await req.json();
    if (!clip_id) return Response.json({ error: 'clip_id required' }, { status: 400 });

    if (provider === 'sonic') {
      const res = await fetch(`${AI_BASE}/sonic/wav`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SONIC_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        return Response.json({
          error: data?.error || data?.message || `Provider HTTP ${res.status}`,
          provider_status: res.status,
          provider_type: data?.type || null,
        }, { status: res.status >= 400 && res.status < 600 ? res.status : 502 });
      }
      const wavUrl = data?.data?.wav_url;
      if (!wavUrl) return Response.json({ error: 'No wav_url returned from provider', raw: data }, { status: 502 });
      return Response.json({ wav_url: wavUrl });
    }

    if (provider === 'producer') {
      // Submit async download task (2 credits, auto-refunded on failure)
      const submitRes = await fetch(`${AI_BASE}/producer/download`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${PRODUCER_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip_id, format: format === 'mp3' ? 'mp3' : 'wav' }),
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok || !submitData.task_id) {
        return Response.json({
          error: submitData?.error || submitData?.message || `Producer HTTP ${submitRes.status}`,
          provider_status: submitRes.status,
          provider_type: submitData?.type || null,
        }, { status: submitRes.status >= 400 && submitRes.status < 600 ? submitRes.status : 502 });
      }

      // Poll the task until SUCCESS or FAILED — typical Producer downloads finish in ~5–15s
      const taskId = submitData.task_id;
      for (let attempt = 0; attempt < 8; attempt++) {
        await sleep(2500);
        const pollRes = await fetch(`${AI_BASE}/producer/task/${taskId}`, {
          headers: { 'Authorization': `Bearer ${PRODUCER_API_KEY}` },
        });
        const pollData = await pollRes.json();
        const st = pollData?.status;
        if (st === 'SUCCESS') {
          const clip = Array.isArray(pollData.data) && pollData.data[0];
          const wav_url = clip?.wav_url || null;
          const audio_url = clip?.audio_url || null;
          if (!wav_url && !audio_url) continue;
          return Response.json({ wav_url, audio_url });
        }
        if (st === 'FAILED') {
          return Response.json({
            error: pollData?.message || 'Producer download failed (credits auto-refunded)',
            provider_type: pollData?.type || 'failed',
          }, { status: 502 });
        }
      }
      // Still pending after ~20s — return task_id so caller can poll later
      return Response.json({ pending: true, task_id: taskId, message: 'Producer download still processing — retry shortly.' }, { status: 202 });
    }

    return Response.json({
      error: 'Unsupported provider. Supported: sonic, producer.',
    }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});