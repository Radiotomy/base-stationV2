import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Fetches a high-quality WAV download URL for an aimusicapi clip on-demand.
 *
 * WHY THIS EXISTS:
 * aimusicapi.ai does NOT auto-publish WAV files to its CDN. Constructed URLs
 * like `https://musicapi-cdn.b-cdn.net/stems/{clip_id}.wav` return 404 because
 * WAV rendering is on-demand per the spec:
 *   POST /api/v1/sonic/wav  { clip_id }  →  { data: { wav_url } }
 *
 * Producer also exposes WAVs but via its own per-clip `wav_url` field that
 * comes back at task-completion time — no separate call needed. If the caller
 * already has a Producer wav_url, they should use it directly.
 *
 * Payload: { clip_id: string, provider?: 'sonic' (default) }
 * Returns: { wav_url: string }
 */

const AI_BASE = 'https://api.aimusicapi.ai/api/v1';
const SONIC_API_KEY = Deno.env.get('SONIC_API_KEY');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { clip_id, provider = 'sonic' } = await req.json();
    if (!clip_id) return Response.json({ error: 'clip_id required' }, { status: 400 });

    if (provider !== 'sonic') {
      return Response.json({
        error: 'WAV on-demand fetch is only supported for Sonic. Producer/Tempolor return wav_url at task completion.',
      }, { status: 400 });
    }

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
    if (!wavUrl) {
      return Response.json({ error: 'No wav_url returned from provider', raw: data }, { status: 502 });
    }

    return Response.json({ wav_url: wavUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});