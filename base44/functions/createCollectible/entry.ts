import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5 — Create a Collectible.
 * Legal gate: media_asset_id must point to a UserAsset whose origin is
 * "creator" or "audius" — Loudly content is forbidden.
 *
 * Payload: { name, description?, media_asset_id?, media_url?, supply?, claim_type?, price_usd? }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      name, description = '', media_asset_id, media_url = '',
      supply = null, claim_type = 'free', price_usd = 0,
    } = await req.json();
    if (!name) return Response.json({ error: 'name required' }, { status: 400 });

    let origin = 'creator';
    let resolvedMediaUrl = media_url;
    if (media_asset_id) {
      const arr = await base44.asServiceRole.entities.UserAsset.filter({ id: media_asset_id });
      const asset = arr[0];
      if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });
      // Ownership check — service-role fetch bypasses RLS, so enforce it here
      if (asset.user_id !== user.id) {
        return Response.json({ error: 'Forbidden: you do not own this asset' }, { status: 403 });
      }
      if (asset.origin === 'loudly') {
        return Response.json({ error: 'Loudly-origin assets cannot be used for collectibles' }, { status: 403 });
      }
      origin = asset.origin === 'audius' ? 'audius' : 'creator';
      resolvedMediaUrl = resolvedMediaUrl || asset.thumbnail_url || asset.file_url;
    }

    const collectible = await base44.asServiceRole.entities.Collectible.create({
      creator_id: user.id,
      creator_name: user.full_name,
      name, description,
      media_asset_id: media_asset_id || null,
      media_url: resolvedMediaUrl,
      supply,
      claimed_count: 0,
      claim_type,
      price_usd,
      origin,
      is_active: true,
    });

    return Response.json({ ok: true, collectible });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});