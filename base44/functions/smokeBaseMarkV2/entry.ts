import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { getV2Prediction } from '../../shared/baseMarkV2.ts';

// Diagnostic helper for BASE Mark V2. Returns the raw Replicate prediction
// object (status, error, container logs, output) for a given prediction id,
// bypassing the asset-lookup short-circuit in finalizeV2Prediction so we can
// see exactly why a prediction failed — including the Python traceback
// Replicate captures in `logs`.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { predictionId } = await req.json();
    if (!predictionId) return Response.json({ error: 'predictionId required' }, { status: 400 });

    const pred = await getV2Prediction(predictionId);
    return Response.json({
      id: pred.id,
      status: pred.status,
      error: pred.error || null,
      logs: pred.logs || null,
      output: pred.output || null,
      urls: pred.urls || null,
      started_at: pred.started_at || null,
      completed_at: pred.completed_at || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});