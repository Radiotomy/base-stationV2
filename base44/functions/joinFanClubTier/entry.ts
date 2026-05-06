import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5 — Join (or upgrade to) a fan club tier.
 * Payload: { fanclubId, tierId }
 *
 * Updates UserXP with the highest active xp_multiplier across all memberships.
 * Logs a FanAction. Real payment integration is out of scope — this is the
 * entitlement/registration step.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { fanclubId, tierId } = await req.json();
    if (!fanclubId || !tierId) return Response.json({ error: 'fanclubId and tierId required' }, { status: 400 });

    const clubs = await base44.asServiceRole.entities.FanClub.filter({ id: fanclubId });
    const club = clubs[0];
    if (!club) return Response.json({ error: 'Fan club not found' }, { status: 404 });

    const tier = (club.tiers || []).find(t => t.id === tierId);
    if (!tier) return Response.json({ error: 'Tier not found' }, { status: 404 });

    if (club.creator_id === user.id) {
      return Response.json({ error: 'Creators cannot join their own fan club' }, { status: 400 });
    }

    // Upsert membership
    const existing = await base44.asServiceRole.entities.FanClubMembership.filter({
      fanclub_id: fanclubId, user_id: user.id,
    });

    let membership;
    if (existing[0]) {
      membership = await base44.asServiceRole.entities.FanClubMembership.update(existing[0].id, {
        tier_id: tier.id,
        tier_name: tier.name,
        xp_multiplier: tier.xp_multiplier || 1,
        status: 'active',
      });
    } else {
      membership = await base44.asServiceRole.entities.FanClubMembership.create({
        fanclub_id: fanclubId,
        creator_id: club.creator_id,
        user_id: user.id,
        user_email: user.email,
        user_name: user.full_name,
        tier_id: tier.id,
        tier_name: tier.name,
        xp_multiplier: tier.xp_multiplier || 1,
        status: 'active',
        joined_at: new Date().toISOString(),
      });
      await base44.asServiceRole.entities.FanClub.update(fanclubId, {
        member_count: (club.member_count || 0) + 1,
      }).catch(() => {});
    }

    // Recompute user's top multiplier across all active memberships
    const allActive = await base44.asServiceRole.entities.FanClubMembership.filter({
      user_id: user.id, status: 'active',
    });
    const top = allActive.reduce((best, m) =>
      (m.xp_multiplier || 1) > (best?.xp_multiplier || 1) ? m : best, null);

    const xpRows = await base44.asServiceRole.entities.UserXP.filter({ user_id: user.id });
    if (xpRows[0]) {
      await base44.asServiceRole.entities.UserXP.update(xpRows[0].id, {
        xp_multiplier: top?.xp_multiplier || 1,
        fanclub_tier_id: top?.tier_id || null,
        fanclub_creator_id: top?.creator_id || null,
      });
    } else {
      await base44.asServiceRole.entities.UserXP.create({
        user_id: user.id,
        user_email: user.email,
        user_name: user.full_name,
        total_xp: 0, level: 1, weekly_xp: 0, monthly_xp: 0,
        xp_multiplier: top?.xp_multiplier || 1,
        fanclub_tier_id: top?.tier_id || null,
        fanclub_creator_id: top?.creator_id || null,
      });
    }

    // Log FanAction (non-blocking)
    base44.asServiceRole.entities.FanAction.create({
      user_id: user.id,
      user_name: user.full_name,
      creator_id: club.creator_id,
      action_type: 'fanclub_join',
      value: tier.price_usd || 0,
      metadata: { fanclub_id: fanclubId, tier_id: tier.id, tier_name: tier.name },
    }).catch(() => {});

    return Response.json({ data: membership, applied_multiplier: top?.xp_multiplier || 1 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});