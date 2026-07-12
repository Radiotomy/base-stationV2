import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5 — Claim a Collectible.
 * Payload: { collectibleId, source?: "free"|"quest"|"purchase"|"live_drop"|"reward", sessionId? }
 *
 * Enforces:
 *  - active flag
 *  - supply (if set)
 *  - one claim per user per collectible
 *  - origin is not "loudly"
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { collectibleId, sessionId = null } = await req.json();
    if (!collectibleId) return Response.json({ error: 'collectibleId required' }, { status: 400 });

    const arr = await base44.asServiceRole.entities.Collectible.filter({ id: collectibleId });
    const c = arr[0];
    if (!c) return Response.json({ error: 'Not found' }, { status: 404 });
    if (!c.is_active) return Response.json({ error: 'Collectible inactive' }, { status: 400 });
    if (c.origin && c.origin === 'loudly') {
      return Response.json({ error: 'Loudly-origin not claimable' }, { status: 403 });
    }
    if (c.supply != null && c.claimed_count >= c.supply) {
      return Response.json({ error: 'Sold out' }, { status: 410 });
    }

    // Enforce the collectible's own claim_type — never trust a client-supplied source.
    const source = c.claim_type || 'free';
    if (source === 'purchase') {
      return Response.json({ error: 'This collectible must be purchased' }, { status: 403 });
    }
    if (source === 'quest') {
      return Response.json({ error: 'This collectible is awarded by quest rewards only' }, { status: 403 });
    }
    if (source === 'live_drop') {
      // Only claimable while it is the active drop in the given live session
      const sessions = sessionId
        ? await base44.asServiceRole.entities.LiveSession.filter({ id: sessionId })
        : [];
      const sess = sessions[0];
      if (!sess || !sess.live_drops_enabled || sess.active_drop_id !== collectibleId) {
        return Response.json({ error: 'This collectible is not currently dropping' }, { status: 403 });
      }
    }

    // Already claimed?
    const existing = await base44.asServiceRole.entities.CollectibleClaim.filter({
      collectible_id: collectibleId, user_id: user.id,
    });
    if (existing[0]) {
      return Response.json({ ok: true, already: true, claim: existing[0] });
    }

    const serial = (c.claimed_count || 0) + 1;
    const claim = await base44.asServiceRole.entities.CollectibleClaim.create({
      collectible_id: collectibleId,
      creator_id: c.creator_id,
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name,
      claim_source: source,
      session_id: sessionId,
      serial_number: serial,
      claimed_at: new Date().toISOString(),
    });

    await base44.asServiceRole.entities.Collectible.update(collectibleId, {
      claimed_count: serial,
    }).catch(() => {});

    // Log fan action (non-blocking)
    base44.asServiceRole.entities.FanAction.create({
      user_id: user.id,
      user_name: user.full_name,
      creator_id: c.creator_id,
      action_type: 'collectible_claim',
      session_id: sessionId,
      metadata: { collectible_id: collectibleId, source, serial_number: serial },
    }).catch(() => {});

    return Response.json({ ok: true, claim, serial_number: serial });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});