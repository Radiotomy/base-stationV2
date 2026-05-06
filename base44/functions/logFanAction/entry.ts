import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5 — Log a Fan → Creator action.
 * Payload: { creator_id, action_type, value?, session_id?, metadata? }
 *
 * action_type ∈ reaction | chat | tip | quest | collectible_claim | fanclub_join | follow | watch_time
 */
const ALLOWED = new Set([
  'reaction', 'chat', 'tip', 'quest',
  'collectible_claim', 'fanclub_join', 'follow', 'watch_time',
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { creator_id, action_type, value = null, session_id = null, metadata = {} } = await req.json();
    if (!creator_id || !action_type) {
      return Response.json({ error: 'creator_id and action_type required' }, { status: 400 });
    }
    if (!ALLOWED.has(action_type)) {
      return Response.json({ error: 'invalid action_type' }, { status: 400 });
    }

    const action = await base44.asServiceRole.entities.FanAction.create({
      user_id: user.id,
      user_name: user.full_name,
      creator_id,
      action_type,
      value,
      session_id,
      metadata,
    });

    return Response.json({ ok: true, action });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});