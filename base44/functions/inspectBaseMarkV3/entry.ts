import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { v3Model, v3Version } from '../../shared/baseMarkV3.ts';

// Admin-only diagnostic: returns the input schema Replicate generated from the
// pushed Drift Layer build. Used to resolve input-validation errors against the
// real schema rather than guessing at the Cog annotations.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const token = Deno.env.get('REPLICATE_API_TOKEN');
    if (!token) return Response.json({ error: 'REPLICATE_API_TOKEN is not set' }, { status: 500 });

    const body = await req.json().catch(() => ({}));

    // `cancel: "<prediction id>"` kills a run stuck in starting/processing.
    // A prediction against a disabled version never resolves on its own and
    // keeps billing hardware, so it has to be cancelled explicitly.
    if (body?.cancel) {
      // Use the cancel URL Replicate hands back on the prediction itself —
      // constructing `/predictions/<id>/cancel` by hand returned 404 even
      // though the same id fetched fine.
      const g = await fetch(`https://api.replicate.com/v1/predictions/${body.cancel}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const gd = await g.json().catch(() => ({}));
      const cancelUrl = gd?.urls?.cancel;
      if (!cancelUrl) {
        return Response.json({ cancelled: false, status: gd?.status ?? g.status, detail: 'no cancel url on prediction' });
      }
      const c = await fetch(cancelUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const cd = await c.json().catch(() => ({}));
      return Response.json({
        cancelled: c.ok,
        http: c.status,
        status: cd?.status ?? null,
        detail: cd?.detail ?? null,
        cancel_url: cancelUrl,
        prediction_status: gd?.status ?? null,
      });
    }
    // `inspect: "<prediction id>"` returns the run's real state and tail of its
    // container logs — the dashboard's "Starting"/"Processing" labels do not say
    // whether the GPU is booting, downloading weights, or actually encoding.
    if (body?.inspect) {
      const r = await fetch(`https://api.replicate.com/v1/predictions/${body.inspect}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json().catch(() => ({}));
      return Response.json({
        id: body.inspect,
        status: d?.status ?? null,
        version: d?.version ?? null,
        created_at: d?.created_at ?? null,
        started_at: d?.started_at ?? null,
        completed_at: d?.completed_at ?? null,
        error: d?.error ?? null,
        logs_tail: (d?.logs || '').slice(-2000),
      });
    }

    // `latest: true` deliberately ignores the pinned secret — after a push we
    // need the id of the build that was just uploaded, which is exactly the
    // thing the (still stale) pin cannot tell us.
    const version = body?.latest ? null : (body?.version || v3Version());
    const url = version
      ? `https://api.replicate.com/v1/models/${v3Model()}/versions/${version}`
      : `https://api.replicate.com/v1/models/${v3Model()}`;

    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    const schema = d?.openapi_schema?.components?.schemas
      || d?.latest_version?.openapi_schema?.components?.schemas;

    return Response.json({
      status: r.status,
      model: v3Model(),
      version,
      // The id to paste into BASE_MARK_V3_VERSION after a `cog push` — the
      // push output only prints the image digest, which is a different thing.
      latest_version: d?.latest_version?.id ?? null,
      input: schema?.Input ?? null,
      output: schema?.Output ?? null,
      detail: d?.detail ?? null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});