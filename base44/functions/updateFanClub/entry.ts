import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5 — Update an existing fan club. Only the creator may update.
 * Payload: { fanclubId, patch }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { fanclubId, patch } = await req.json();
    if (!fanclubId || !patch) return Response.json({ error: 'fanclubId and patch required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.FanClub.filter({ id: fanclubId });
    const club = rows[0];
    if (!club) return Response.json({ error: 'Fan club not found' }, { status: 404 });
    if (club.creator_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Whitelist editable fields
    const allowed = ['name', 'description', 'cover_image_url', 'tiers', 'is_active'];
    const safePatch = {};
    for (const key of allowed) if (patch[key] !== undefined) safePatch[key] = patch[key];

    const updated = await base44.asServiceRole.entities.FanClub.update(fanclubId, safePatch);
    return Response.json({ data: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});