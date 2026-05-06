import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5 — OPTIONAL: Mint a Collectible to Audius/OpenAudio.
 * No-op if Audius minting is not configured server-side.
 *
 * Payload: { collectibleId }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { collectibleId } = await req.json();
    if (!collectibleId) return Response.json({ error: 'collectibleId required' }, { status: 400 });

    const arr = await base44.asServiceRole.entities.Collectible.filter({ id: collectibleId });
    const c = arr[0];
    if (!c) return Response.json({ error: 'Not found' }, { status: 404 });
    if (c.creator_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Legal gate
    if (c.origin === 'loudly') {
      return Response.json({ error: 'Loudly-origin cannot be minted' }, { status: 403 });
    }

    // Delegate to audiusClient — graceful no-op if not implemented
    let audius_collectible_id = null;
    try {
      const r = await base44.asServiceRole.functions.invoke('audiusClient', {
        action: 'mintCollectible',
        payload: {
          name: c.name,
          description: c.description,
          media_url: c.media_url,
          supply: c.supply,
          creator_id: c.creator_id,
        },
      });
      audius_collectible_id = r?.data?.data?.collectible_id || r?.data?.collectible_id || null;
    } catch {
      return Response.json({ ok: false, reason: 'audius_unavailable' });
    }

    if (audius_collectible_id) {
      await base44.asServiceRole.entities.Collectible.update(collectibleId, { audius_collectible_id });
    }
    return Response.json({ ok: !!audius_collectible_id, audius_collectible_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});