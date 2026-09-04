import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Publish a LiveSessionBundle to Audius.
 * Validates that no Loudly-origin assets were used in the session.
 *
 * Payload: { bundleId }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bundleId } = await req.json();
    if (!bundleId) return Response.json({ error: 'bundleId required' }, { status: 400 });

    const bundles = await base44.entities.LiveSessionBundle.filter({ id: bundleId });
    const bundle = bundles[0];
    if (!bundle) return Response.json({ error: 'Bundle not found' }, { status: 404 });
    if (bundle.performer_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // === LEGAL GATE: validate no Loudly assets used ===
    const tracksUsed = bundle.metadata?.tracks_used || [];
    if (tracksUsed.length > 0) {
      const usedAssets = await Promise.all(
        tracksUsed.map(id =>
          base44.asServiceRole.entities.UserAsset.filter({ id }).then(r => r[0]).catch(() => null)
        )
      );
      const hasLoudly = usedAssets.some(a => a && a.origin === 'loudly');
      if (hasLoudly) {
        await base44.asServiceRole.entities.LiveSessionBundle.update(bundleId, {
          audius_publish_status: 'failed',
          audius_publish_error: 'Session contains Loudly catalog tracks — cannot publish to Audius.',
        });
        return Response.json({
          error: 'Session contains Loudly catalog tracks. Cannot publish to Audius.',
        }, { status: 403 });
      }
    }

    // Mark pending
    await base44.asServiceRole.entities.LiveSessionBundle.update(bundleId, {
      audius_publish_status: 'pending',
    });

    // Publish via audiusClient
    const publishRes = await base44.asServiceRole.functions.invoke('audiusClient', {
      action: 'publishBundle',
      payload: {
        title: bundle.title,
        mixdown_url: bundle.mixdown_url,
        event_log_url: bundle.event_log_url,
        chat_log_url: bundle.chat_log_url,
        metadata: bundle.metadata,
        performer_id: bundle.performer_id,
      },
    });

    const audiusTrackId = publishRes?.data?.audius_track_id || publishRes?.audius_track_id;
    const status = publishRes?.data?.status || 'pending';
    const note = publishRes?.data?.note || null;

    // A simulated publish is NOT a success. Recording it as one is what made the
    // Live Manager show an "On Audius" checkmark for a session that never left
    // the platform, so it stays 'pending' and carries the reason.
    await base44.asServiceRole.entities.LiveSessionBundle.update(bundleId, {
      audius_track_id: audiusTrackId,
      audius_publish_status: status === 'success' ? 'success' : 'pending',
      audius_publish_error: status === 'simulated' ? (note || 'Audius publishing is not wired yet — this was a simulated publish.') : '',
    });

    return Response.json({
      data: { bundle_id: bundleId, audius_track_id: audiusTrackId, status }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});