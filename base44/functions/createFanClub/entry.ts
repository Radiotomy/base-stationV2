import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5 — Create a fan club for the current creator (one per creator).
 * Payload: { name, description?, cover_image_url?, tiers? }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, description = '', cover_image_url = '', tiers } = await req.json();
    if (!name) return Response.json({ error: 'name required' }, { status: 400 });

    // One fan club per creator — return existing if any
    const existing = await base44.asServiceRole.entities.FanClub.filter({ creator_id: user.id });
    if (existing[0]) return Response.json({ data: existing[0], existed: true });

    const defaultTiers = [
      { id: 'supporter', name: 'Supporter', description: 'Show your support', price_usd: 5,  perks: ['Supporter badge', '1.25× XP'],  xp_multiplier: 1.25, color: '#a78bfa' },
      { id: 'insider',   name: 'Insider',   description: 'Behind the scenes', price_usd: 15, perks: ['All Supporter perks', 'Early drops', '1.5× XP'], xp_multiplier: 1.5, color: '#60a5fa' },
      { id: 'vip',       name: 'VIP',       description: 'Top-tier access',   price_usd: 35, perks: ['All Insider perks', 'Exclusive collectibles', '2× XP'], xp_multiplier: 2, color: '#f59e0b' },
    ];

    const club = await base44.asServiceRole.entities.FanClub.create({
      creator_id: user.id,
      creator_email: user.email,
      creator_name: user.full_name,
      name, description, cover_image_url,
      tiers: Array.isArray(tiers) && tiers.length > 0 ? tiers : defaultTiers,
      is_active: true,
      member_count: 0,
    });

    return Response.json({ data: club });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});