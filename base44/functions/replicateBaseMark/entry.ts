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

    const { action, query, model, version, input, cursor, status_filter, id, fileUrl, filename, contentType, deployment } = await req.json();

    // Admin-only operations — protects prediction execution and account
    // management from non-admins invoking the endpoint directly and burning
    // the platform's REPLICATE_API_TOKEN credits on arbitrary models.
    const adminOnly = ['predictions', 'cancel', 'uploadFile', 'versions', 'checkDeployment', 'run'];
    if (adminOnly.includes(action) && user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

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
        run_count: m.run_count,
        latest_version: m.latest_version?.id,
        default_example: m.default_example?.id,
        openapi_input_schema: m.latest_version?.openapi_schema?.components?.schemas?.Input,
      });
    }

    if (action === 'checkDeployment') {
      const target = deployment || model;
      if (!target) return Response.json({ error: 'deployment (owner/name) is required' }, { status: 400 });
      const r = await fetch(`https://api.replicate.com/v1/deployments/${target}`, { headers });
      if (!r.ok) return Response.json({ ok: false, status: r.status, error: 'Deployment not found or not accessible' });
      const d = await r.json();
      return Response.json({
        ok: true,
        name: d.name,
        owner: d.owner,
        model: d.model,
        release_info: d.release || d.version_release,
        hardware: d.hardware,
        min_instances: d.min_instances,
        max_instances: d.max_instances,
        created_at: d.created_at,
        updated_at: d.updated_at,
        raw: d,
      });
    }

    if (action === 'versions') {
      if (!model) return Response.json({ error: 'model is required (owner/name)' }, { status: 400 });
      const url = new URL(`https://api.replicate.com/v1/models/${model}/versions`);
      if (cursor) url.searchParams.set('cursor', cursor);
      const r = await fetch(url.toString(), { headers });
      const data = await r.json();
      if (!r.ok) return Response.json({ ok: false, status: r.status, error: data });
      const trimmed = (data.results || []).map((v) => ({
        id: v.id,
        created_at: v.created_at,
        cog_info: v.cog_info && { name: v.cog_info.name, image_visibility: v.cog_info.image_visibility },
      }));
      return Response.json({ ok: true, results: trimmed, next: data.next, previous: data.previous });
    }

    if (action === 'predictions') {
      const url = new URL('https://api.replicate.com/v1/predictions');
      if (cursor) url.searchParams.set('cursor', cursor);
      if (status_filter) url.searchParams.set('status', status_filter);
      const r = await fetch(url.toString(), { headers });
      const data = await r.json();
      if (!r.ok) return Response.json({ ok: false, status: r.status, error: data });
      const trimmed = (data.results || []).map((p) => ({
        id: p.id, status: p.status, version: p.version,
        created_at: p.created_at, completed_at: p.completed_at,
        source: p.source?.api_key ? 'api' : p.source,
        input: p.input, output: p.output, error: p.error,
      }));
      return Response.json({ ok: true, results: trimmed, next: data.next, previous: data.previous });
    }

    if (action === 'cancel') {
      if (!id) return Response.json({ error: 'id (prediction id) is required' }, { status: 400 });
      const r = await fetch(`https://api.replicate.com/v1/predictions/${id}/cancel`, { method: 'POST', headers });
      const data = await r.json();
      if (!r.ok) return Response.json({ ok: false, status: r.status, error: data });
      return Response.json({ ok: true, id: data.id, status: data.status });
    }

    if (action === 'uploadFile') {
      // Replicate Files API — register a private asset through Replicate's
      // own storage so it can be used as an `audio` input via the replicates://
      // URL scheme. Useful when an asset isn't publicly fetchable/cors-friendly.
      if (!fileUrl) return Response.json({ error: 'fileUrl is required' }, { status: 400 });
      const r = await fetch(fileUrl);
      if (!r.ok) return Response.json({ error: `Failed to fetch ${fileUrl}` }, { status: 502 });
      const blob = await r.blob();
      const contentType = blob.type || contentType || 'application/octet-stream';
      const safeName = (filename || 'upload').replace(/[^\w.\-]/g, '_').slice(0, 200);
      const form = new FormData();
      form.append('filename', safeName);
      form.append('content_type', contentType);
      form.append('content', blob, safeName);
      const up = await fetch('https://api.replicate.com/v1/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form,
      });
      const upData = await up.json();
      if (!up.ok) return Response.json({ ok: false, status: up.status, error: upData });
      return Response.json({
        ok: true,
        file_id: upData.id,
        name: upData.name,
        replicates_url: (upData.urls && (upData.urls.get || upData.urls.download)) || upData.uri,
        size_bytes: upData.size,
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