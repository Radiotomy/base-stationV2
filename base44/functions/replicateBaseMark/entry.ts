import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Bridge to the user's Replicate account for neural (AudioSeal-style) watermarking.
// Actions:
//   { action: "status" }                      -> verifies the API token, returns account info
//   { action: "search", query: "audioseal" }  -> searches public Replicate models
//   { action: "checkModel", model: "owner/name" } -> checks a specific model exists + latest version
//   { action: "run", model, version?, input } -> runs a prediction (blocking wait), returns output
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const token = Deno.env.get('REPLICATE_API_TOKEN');
    if (!token) return Response.json({ error: 'REPLICATE_API_TOKEN is not set' }, { status: 500 });
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    const { action, query, model, version, input } = await req.json();

    if (action === 'status') {
      const r = await fetch('https://api.replicate.com/v1/account', { headers });
      const data = await r.json();
      return Response.json({ ok: r.ok, status: r.status, account: r.ok ? data : undefined, error: r.ok ? undefined : data });
    }

    if (action === 'search') {
      const r = await fetch('https://api.replicate.com/v1/models', {
        method: 'QUERY',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/plain' },
        body: query || 'audio watermark',
      });
      const data = await r.json();
      const models = (data.results || []).map((m) => ({
        model: `${m.owner}/${m.name}`,
        description: m.description,
        run_count: m.run_count,
        latest_version: m.latest_version?.id,
      }));
      return Response.json({ ok: r.ok, count: models.length, models });
    }

    if (action === 'checkModel') {
      if (!model) return Response.json({ error: 'model is required (owner/name)' }, { status: 400 });
      const r = await fetch(`https://api.replicate.com/v1/models/${model}`, { headers });
      if (!r.ok) return Response.json({ ok: false, status: r.status, error: 'Model not found or not accessible' });
      const m = await r.json();
      return Response.json({
        ok: true,
        model: `${m.owner}/${m.name}`,
        description: m.description,
        visibility: m.visibility,
        latest_version: m.latest_version?.id,
        openapi_input_schema: m.latest_version?.openapi_schema?.components?.schemas?.Input,
      });
    }

    if (action === 'run') {
      if (!model || !input) return Response.json({ error: 'model and input are required' }, { status: 400 });
      let url, body;
      if (version) {
        url = 'https://api.replicate.com/v1/predictions';
        body = { version, input };
      } else {
        url = `https://api.replicate.com/v1/models/${model}/predictions`;
        body = { input };
      }
      const r = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'wait=60' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) return Response.json({ ok: false, status: r.status, error: data });
      return Response.json({ ok: true, id: data.id, status: data.status, output: data.output, error: data.error });
    }

    return Response.json({ error: 'Unknown action. Use status | search | checkModel | run' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});