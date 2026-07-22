import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { calculateHumanParticipationScore } from '../../shared/cosEngine.ts';

// Authoritative Creative Ownership Score calculation.
// The frontend sends raw creative-process telemetry and receives only the
// computed result — the scoring heuristics live exclusively server-side.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const inputs = await req.json();
    const result = calculateHumanParticipationScore(inputs || {});
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});