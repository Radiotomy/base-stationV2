import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Phase 9 — Artist Revenue Dashboard.
// Aggregates every revenue signal tied to a creator: fan tips, fan club membership
// dues, and collectible sales. Returns totals + recent activity for the dashboard.
//
// NOTE: BASE Station's payment intake (Stripe) is not live yet — tips and purchases
// are recorded so creators can see projected/tracked earnings, but no real money has
// moved. The response includes `payments_live: false` so the UI can show that caveat.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const creatorId = user.id;

    const [tips, memberships, fanClubs, claims, collectibles] = await Promise.all([
      base44.asServiceRole.entities.Tip.filter({ to_artist_id: creatorId, status: 'completed' }, '-created_date', 200),
      base44.asServiceRole.entities.FanClubMembership.filter({ creator_id: creatorId, status: 'active' }, '-created_date', 500),
      base44.asServiceRole.entities.FanClub.filter({ creator_id: creatorId }),
      base44.asServiceRole.entities.CollectibleClaim.filter({ creator_id: creatorId, claim_source: 'purchase' }, '-claimed_at', 200),
      base44.asServiceRole.entities.Collectible.filter({ creator_id: creatorId }),
    ]);

    // ── Tips ──────────────────────────────────────────────────────────────────
    const tipsTotalCents = tips.reduce((s, t) => s + (t.amount_cents || 0), 0);

    // ── Fan club membership revenue (recurring, monthly) ────────────────────────
    const tierPriceMap = {};
    for (const club of fanClubs) {
      for (const tier of club.tiers || []) tierPriceMap[tier.id] = tier.price_usd || 0;
    }
    const membershipMonthlyUsd = memberships.reduce((s, m) => s + (tierPriceMap[m.tier_id] || 0), 0);
    const membersByTier = {};
    for (const m of memberships) {
      const key = m.tier_name || m.tier_id || 'Unknown';
      membersByTier[key] = (membersByTier[key] || 0) + 1;
    }

    // ── Collectible sales ────────────────────────────────────────────────────────
    const collectiblePriceMap = {};
    for (const c of collectibles) collectiblePriceMap[c.id] = c.price_usd || 0;
    const collectibleSalesUsd = claims.reduce((s, c) => s + (collectiblePriceMap[c.collectible_id] || 0), 0);

    const totalTrackedUsd = (tipsTotalCents / 100) + membershipMonthlyUsd + collectibleSalesUsd;

    return Response.json({
      payments_live: false,
      totals: {
        tips_usd: tipsTotalCents / 100,
        membership_monthly_usd: membershipMonthlyUsd,
        collectible_sales_usd: collectibleSalesUsd,
        total_tracked_usd: totalTrackedUsd,
      },
      tips: {
        count: tips.length,
        recent: tips.slice(0, 10).map(t => ({
          id: t.id, from_user_name: t.from_user_name, amount_cents: t.amount_cents,
          message: t.message, track_title: t.track_title, created_date: t.created_date,
        })),
      },
      membership: {
        active_count: memberships.length,
        by_tier: membersByTier,
      },
      collectibles: {
        sales_count: claims.length,
        recent: claims.slice(0, 10).map(c => ({
          id: c.id, user_name: c.user_name,
          collectible_name: (collectibles.find(x => x.id === c.collectible_id) || {}).name || 'Unknown',
          price_usd: collectiblePriceMap[c.collectible_id] || 0,
          claimed_at: c.claimed_at,
        })),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});