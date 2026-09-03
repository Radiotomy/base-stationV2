import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Fetches a high-quality WAV (or MP3 / M4A) download URL for an aimusicapi clip on-demand.
 *
 * Sonic flow (audit 2026-09-03 — docs.aimusicapi.ai/api-42922935):
 *   POST /api/v1/sonic/download { clip_id, formats: ['wav', ...] }
 *     200 → { data: { clip_id, files: [{ format, file_url }] } }   (2 credits, any format count)
 *     202 → files still preparing — free to retry; we retry inline a few times.
 *     404 → source audio no longer retained upstream; the caller must regenerate.
 *   The legacy POST /sonic/wav (1 credit) is used as a fallback when /download is
 *   unavailable, so older clips still resolve.
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

    const { clip_id, provider = 'sonic', format = 'wav', asset_id } = await req.json();
    if (!clip_id) return Response.json({ error: 'clip_id required' }, { status: 400 });

    // Embed COS provenance ID3 tags into an mp3 download (best-effort, ID3 is mp3-only)
    const embedProvenance = async (mp3Url) => {
      if (!asset_id || !mp3Url) return null;
      try {
        const res = await base44.functions.invoke('editID3Tags', { audio_url: mp3Url, asset_id });
        return res?.data?.download_url || res?.download_url || null;
      } catch (_) { return null; }
    };

    if (provider === 'sonic') {
      const headers = { 'Authorization': `Bearer ${SONIC_API_KEY}`, 'Content-Type': 'application/json' };
      const wanted = Array.isArray(format) ? format : [format === 'mp3' ? 'mp3' : format === 'm4a' ? 'm4a' : 'wav'];

      // /download: 202 means "preparing, retry free" — give it ~15s before giving up.
      let last = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const res = await fetch(`${AI_BASE}/sonic/download`, {
          method: 'POST', headers, body: JSON.stringify({ clip_id, formats: wanted }),
        });
        const data = await res.json().catch(() => ({}));
        last = { res, data };
        if (res.status === 202) { await sleep(3000); continue; }
        if (res.ok && Array.isArray(data?.data?.files)) {
          const files = data.data.files;
          const byFmt = Object.fromEntries(files.map(f => [f.format, f.file_url]));
          const tagged_url = byFmt.mp3 ? await embedProvenance(byFmt.mp3) : null;
          return Response.json({
            wav_url: byFmt.wav || null,
            audio_url: byFmt.mp3 || null,
            m4a_url: byFmt.m4a || null,
            files, tagged_url, provenance_embedded: !!tagged_url,
          });
        }
        break;
      }

      if (last?.res?.status === 202) {
        return Response.json({ pending: true, message: 'Sonic is still preparing the file — retry shortly.' }, { status: 202 });
      }
      if (last?.res?.status === 404) {
        return Response.json({
          error: 'Sonic no longer retains the source audio for this clip. Regenerate the track to get a fresh lossless master.',
          provider_status: 404,
        }, { status: 404 });
      }

      // Fallback: legacy /wav (still live, WAV only)
      if (wanted.includes('wav')) {
        const res = await fetch(`${AI_BASE}/sonic/wav`, { method: 'POST', headers, body: JSON.stringify({ clip_id }) });
        const data = await res.json().catch(() => ({}));
        const wavUrl = data?.data?.wav_url;
        if (res.ok && wavUrl) return Response.json({ wav_url: wavUrl });
      }

      return Response.json({
        error: last?.data?.error || last?.data?.message || `Provider HTTP ${last?.res?.status}`,
        provider_status: last?.res?.status,
        provider_type: last?.data?.type || null,
      }, { status: last?.res?.status >= 400 && last?.res?.status < 600 ? last.res.status : 502 });
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
          // Provenance tagging applies to the mp3 stream (WAV has no ID3v2 container)
          const tagged_url = format === 'mp3' ? await embedProvenance(audio_url) : null;
          return Response.json({ wav_url, audio_url, tagged_url, provenance_embedded: !!tagged_url });
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