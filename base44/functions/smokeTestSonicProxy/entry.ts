// Admin smoke test: verify Sonic accepts a URL routed through streamAudioForProvider.
// Uses the new path-based form so the URL ends in ".mp3".
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SONIC_API_KEY = Deno.env.get('SONIC_API_KEY');

function b64urlEncode(s) {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { source_url } = await req.json();
    const appId = Deno.env.get('BASE44_APP_ID');
    const proxyUrl = `https://base44.app/api/apps/${appId}/functions/streamAudioForProvider?u=${encodeURIComponent(source_url)}`;

    // Verify HEAD works
    const head = await fetch(proxyUrl, { method: 'HEAD' });
    const get = await fetch(proxyUrl, { method: 'GET', headers: { Range: 'bytes=0-1' } });

    // Call Sonic's /sonic/upload (the simple upload endpoint, matching the docs)
    const sonicRes = await fetch('https://api.aimusicapi.ai/api/v1/sonic/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SONIC_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: proxyUrl }),
    });
    const sonicData = await sonicRes.json();

    return Response.json({
      proxy_url: proxyUrl,
      proxy_head_status: head.status,
      proxy_get_status: get.status,
      sonic_http_status: sonicRes.status,
      sonic_clip_id: sonicData?.clip_id || sonicData?.data?.clip_id || null,
      sonic_error: sonicData?.error || sonicData?.message || null,
      raw: sonicData,
      verdict: sonicRes.ok && (sonicData?.clip_id || sonicData?.data?.clip_id)
        ? '✅ SONIC ACCEPTED — .mp3 path form works'
        : '❌ Still rejected',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});