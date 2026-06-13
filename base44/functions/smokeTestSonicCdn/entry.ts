// Smoke test: does Sonic accept a known-good third-party CDN URL?
// If yes, the issue is specifically Sonic refusing base44.app.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SONIC_API_KEY = Deno.env.get('SONIC_API_KEY');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { test_url } = await req.json().catch(() => ({}));
    // Default: a small public mp3 from a non-base44 host
    // A small public mp3 known to be live (BBC sound effects archive mirror)
    const url = test_url || 'https://www2.cs.uic.edu/~i101/SoundFiles/CantinaBand3.wav';

    const sonicRes = await fetch('https://api.aimusicapi.ai/api/v1/sonic/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SONIC_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const sonicData = await sonicRes.json();

    return Response.json({
      test_url: url,
      sonic_http_status: sonicRes.status,
      sonic_clip_id: sonicData?.clip_id || sonicData?.data?.clip_id || null,
      sonic_error: sonicData?.error || sonicData?.message || null,
      raw: sonicData,
      verdict: sonicRes.ok && (sonicData?.clip_id || sonicData?.data?.clip_id)
        ? '✅ Sonic accepted external CDN — host blacklist is the issue'
        : '❌ Sonic rejected even external CDN — issue is not host',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});