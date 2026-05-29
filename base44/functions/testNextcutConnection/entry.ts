import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const NEXTCUT_API = Deno.env.get('NEXTCUT_API');
const NEXTCUT_BASE_URL = 'https://api.nextcut.io';

/**
 * Admin-only connectivity & capability probe for the NextCut API.
 * Sends the smallest valid render request (a 1-second solid background)
 * to confirm:
 *   - the API key is accepted
 *   - the /api-render endpoint is reachable
 *   - we receive a renderId / outputUrl back
 *
 * Returns a structured diagnostic payload so we can verify the integration
 * before wiring it into the music-video pipeline.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    if (!NEXTCUT_API) {
      return Response.json({
        ok: false,
        reason: 'missing_secret',
        message: 'NEXTCUT_API secret is not set',
      }, { status: 500 });
    }

    // Minimal smoke-test render: 1s (30 frames) gradient at 1280x720
    const probeBody = {
      scenes: [
        {
          startFrame: 0,
          endFrame: 30,
          layers: [
            {
              type: 'gradient',
              props: {
                type: 'linear',
                colors: ['#0A0A12', '#6C9EFF'],
                angle: 135,
              },
            },
            {
              type: 'text',
              props: {
                content: 'Base Station × NextCut OK',
                fontSize: 48,
                fontFamily: 'Arial',
                color: '#ffffff',
                x: '50%',
                y: '50%',
                align: 'center',
              },
            },
          ],
        },
      ],
      width: 1080,
      height: 720,
      fps: 30,
    };

    const t0 = Date.now();
    const res = await fetch(`${NEXTCUT_BASE_URL}/api-render`, {
      method: 'POST',
      headers: {
        'x-api-key': NEXTCUT_API,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(probeBody),
    });
    const durationMs = Date.now() - t0;

    const responseText = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(responseText); } catch { /* keep raw */ }

    const diagnostics = {
      ok: res.ok,
      http_status: res.status,
      latency_ms: durationMs,
      api_key_present: true,
      api_key_length: NEXTCUT_API.length,
      base_url: NEXTCUT_BASE_URL,
      endpoint: '/api-render',
      raw_response: parsed || responseText.slice(0, 500),
    };

    if (res.status === 401) {
      diagnostics.diagnosis = 'API key rejected — check NEXTCUT_API value in secrets.';
    } else if (res.status === 429) {
      diagnostics.diagnosis = 'Rate limited (10 req/min per key). Retry shortly.';
    } else if (res.status === 202) {
      diagnostics.diagnosis = 'Render queued (long-poll). renderId returned; SDK polling required.';
      diagnostics.render_id = parsed?.renderId;
      diagnostics.bucket_name = parsed?.bucketName;
    } else if (res.ok) {
      diagnostics.diagnosis = 'NextCut is reachable and rendering correctly.';
      diagnostics.render_id = parsed?.renderId;
      diagnostics.output_url = parsed?.outputUrl;
      diagnostics.render_duration_ms = parsed?.durationMs;
      diagnostics.render_cost_usd = parsed?.cost;
    } else {
      diagnostics.diagnosis = `Unexpected response (${res.status}). See raw_response.`;
    }

    return Response.json(diagnostics, { status: res.ok ? 200 : 200 });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error.message,
      stack: error.stack?.slice(0, 500),
    }, { status: 500 });
  }
});