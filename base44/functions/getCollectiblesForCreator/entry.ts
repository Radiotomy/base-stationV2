import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5 — List all active collectibles for a creator,
 * plus a flag indicating whether the requesting user has claimed each.
 *
 * Payload: { creatorId }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    const { creatorId } = await req.json();
    if (!creatorId) return Response.json({ error: 'creatorId required' }, { status: 400 });

    const collectibles = await base44.asServiceRole.entities.Collectible.filter({
      creator_id: creatorId, is_active: true,
    }, '-created_date', 100);

    let claimedSet = new Set();
    if (user) {
      const claims = await base44.asServiceRole.entities.CollectibleClaim.filter({
        user_id: user.id, creator_id: creatorId,
      });
      claimedSet = new Set(claims.map(c => c.collectible_id));
    }

    return Response.json({
      collectibles: collectibles.map(c => ({
        ...c,
        user_has_claimed: claimedSet.has(c.id),
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});