import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5 — Aggregate everything needed to render a creator storefront.
 *
 * Payload: { creatorId }
 * Returns: { fanclub, collectibles, audius_tracks, session_bundles, live_drops_history }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await base44.auth.me().catch(() => null); // optional viewer

    const { creatorId } = await req.json();
    if (!creatorId) return Response.json({ error: 'creatorId required' }, { status: 400 });

    const [fcArr, collectibles, bundles, audiusAssets] = await Promise.all([
      base44.asServiceRole.entities.FanClub.filter({ creator_id: creatorId, is_active: true }),
      base44.asServiceRole.entities.Collectible.filter({ creator_id: creatorId, is_active: true }, '-created_date', 50),
      base44.asServiceRole.entities.LiveSessionBundle.filter({ performer_id: creatorId }, '-created_date', 20),
      base44.asServiceRole.entities.UserAsset.filter({ user_id: creatorId, origin: 'audius' }, '-created_date', 30),
    ]);

    // Live drop history = collectibles with claim_type=live_drop or claims tagged with session_id
    const dropClaims = await base44.asServiceRole.entities.CollectibleClaim.filter({
      creator_id: creatorId, claim_source: 'live_drop',
    }, '-claimed_at', 50);

    return Response.json({
      fanclub: fcArr[0] || null,
      collectibles,
      session_bundles: bundles,
      audius_tracks: audiusAssets,
      live_drops_history: dropClaims,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});