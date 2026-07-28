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

    const version = v3Version();
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
      input: schema?.Input ?? null,
      output: schema?.Output ?? null,
      detail: d?.detail ?? null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});