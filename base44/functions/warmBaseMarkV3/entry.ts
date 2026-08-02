import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { v3Model, v3Version, v3Deployment } from '../../shared/baseMarkV3.ts';

// Admin-only scale control for the Drift Layer GPU.
//
// Replicate bills a private deployment for ALL time an instance is online —
// boot, idle and active alike. So min_instances=1 on a T4 is a flat
// $0.000225/sec ($0.81/hr) whether or not anything is running. That is the
// whole trade: pay idle time to delete the ~4 minute cold start.
//
// Because idle time bills, `cool` is not optional housekeeping — a deployment
// left warm overnight costs ~$19/day for nothing. Every response therefore
// reports the burn rate and how to turn it off.

const T4_PER_SEC = 0.000225;
const T4_PER_HOUR = T4_PER_SEC * 3600; // 0.81

function api(path: string, init: RequestInit = {}) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  return fetch(`https://api.replicate.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

function summarize(d: any) {
  const cur = d?.current_release;
  const cfg = cur?.configuration;
  const min = cfg?.min_instance ?? cfg?.min_instances ?? null;
  const warm = (min ?? 0) > 0;
  return {
    deployment: v3Deployment(),
    exists: true,
    warm,
    min_instances: min,
    max_instances: cfg?.max_instance ?? cfg?.max_instances ?? null,
    hardware: cfg?.hardware ?? null,
    version: cur?.version ?? null,
    // Cost is stated on every response so a forgotten warm pool is visible
    // the moment anyone looks at status, not at the end of the month.
    burn_rate_usd_per_hour: warm ? Number((T4_PER_HOUR * (min || 1)).toFixed(4)) : 0,
    note: warm
      ? 'BILLING NOW — idle time counts. Call action:"cool" when testing is done.'
      : 'Scaled to zero. Not billing. Next prediction pays the ~4 min cold start.',
  };
}

async function getDeployment() {
  const r = await api(`/deployments/${v3Deployment()}`);
  if (r.status === 404) return null;
  const d = await r.json();
  if (!r.ok) throw new Error(`Deployment read failed (${r.status}): ${d?.detail || ''}`);
  return d;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body?.action || 'status';
    const [, name] = v3Deployment().split('/');

    const existing = await getDeployment();

    if (action === 'status') {
      if (!existing) {
        return Response.json({
          deployment: v3Deployment(),
          exists: false,
          warm: false,
          burn_rate_usd_per_hour: 0,
          note: 'No deployment yet. action:"warm" creates it and scales it to 1.',
        });
      }
      return Response.json(summarize(existing));
    }

    if (action === 'warm') {
      const min = Number(body?.instances ?? 1);
      if (!Number.isInteger(min) || min < 1 || min > 2) {
        return Response.json({ error: 'instances must be 1 or 2' }, { status: 400 });
      }

      if (!existing) {
        // First warm-up also creates the deployment, pinned to the same version
        // the direct-model path uses so warm and cold runs are the same build.
        const version = v3Version();
        if (!version) {
          return Response.json(
            { error: 'BASE_MARK_V3_VERSION is not set — refusing to create a deployment on an unpinned build.' },
            { status: 400 },
          );
        }
        const r = await api('/deployments', {
          method: 'POST',
          body: JSON.stringify({
            name,
            model: v3Model(),
            version,
            hardware: 'gpu-t4',
            min_instance: min,
            max_instance: Math.max(min, 2),
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(`Create failed (${r.status}): ${d?.detail || JSON.stringify(d)}`);
        return Response.json({ ...summarize(d), created: true, warming_seconds_estimate: 240 });
      }

      const r = await api(`/deployments/${v3Deployment()}`, {
        method: 'PATCH',
        // Replicate has used both spellings across API versions and silently
        // ignores the one it does not recognize (a create sent with the wrong
        // key came back scaled to 0/5 defaults), so send both.
        body: JSON.stringify({
          min_instance: min,
          max_instance: Math.max(min, 2),
          min_instances: min,
          max_instances: Math.max(min, 2),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(`Scale up failed (${r.status}): ${d?.detail || JSON.stringify(d)}`);
      return Response.json({ ...summarize(d), created: false, warming_seconds_estimate: 240 });
    }

    if (action === 'cool') {
      if (!existing) {
        return Response.json({ deployment: v3Deployment(), exists: false, warm: false, burn_rate_usd_per_hour: 0 });
      }
      // Scale to zero rather than deleting: the deployment config is reusable,
      // and a scaled-to-zero deployment bills nothing.
      const r = await api(`/deployments/${v3Deployment()}`, {
        method: 'PATCH',
        body: JSON.stringify({ min_instance: 0, max_instance: 2, min_instances: 0, max_instances: 2 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(`Scale down failed (${r.status}): ${d?.detail || JSON.stringify(d)}`);
      return Response.json({ ...summarize(d), cooled: true });
    }

    return Response.json({ error: `Unknown action "${action}" — use status, warm or cool.` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});