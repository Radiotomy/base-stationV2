import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5 — Sync Audius collectibles & badges into User.metadata.audius.collectibles.
 * Designed to extend syncAudiusIdentity without modifying it.
 *
 * Payload: { audiusUserId? }  (defaults to current user's stored audius id)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let { audiusUserId } = await req.json().catch(() => ({}));
    audiusUserId = audiusUserId || user.metadata?.audius?.audius_user_id;
    if (!audiusUserId) return Response.json({ error: 'No Audius identity' }, { status: 400 });

    let collectibles = [];
    let badges = [];
    try {
      const r = await base44.asServiceRole.functions.invoke('audiusClient', {
        action: 'getCollectibles',
        payload: { userId: audiusUserId },
      });
      collectibles = r?.data?.data?.collectibles || r?.data?.collectibles || [];
      badges = r?.data?.data?.badges || r?.data?.badges || [];
    } catch {
      return Response.json({ ok: false, reason: 'audius_unavailable' });
    }

    const audiusMeta = {
      ...(user.metadata?.audius || {}),
      collectibles,
      badges,
      collectibles_synced_at: new Date().toISOString(),
    };
    await base44.auth.updateMe({
      metadata: { ...(user.metadata || {}), audius: audiusMeta },
    });

    return Response.json({ ok: true, count: collectibles.length, badges_count: badges.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});