import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5 — Fetch fan club for a creator + the current user's membership (if any).
 * Payload: { creatorId }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    const { creatorId } = await req.json();
    if (!creatorId) return Response.json({ error: 'creatorId required' }, { status: 400 });

    const clubs = await base44.asServiceRole.entities.FanClub.filter({ creator_id: creatorId });
    const club = clubs[0] || null;

    let membership = null;
    if (club && user) {
      const m = await base44.asServiceRole.entities.FanClubMembership.filter({
        fanclub_id: club.id, user_id: user.id,
      });
      membership = m[0] || null;
    }

    return Response.json({ data: { club, membership } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});