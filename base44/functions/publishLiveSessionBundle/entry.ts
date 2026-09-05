import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Publish a LiveSessionBundle to Audius.
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

    // Bundle publishing is not supported by Audius through our client yet, so this
    // now returns a real failure. Recording anything else as success is what made
    // the Live Manager show "On Audius" for a session that never left the platform.
    const publishError = publishRes?.error || publishRes?.data?.error;
    if (publishError) {
      await base44.asServiceRole.entities.LiveSessionBundle.update(bundleId, {
        audius_publish_status: 'failed',
        audius_publish_error: publishError,
      });
      return Response.json({ error: publishError }, { status: 501 });
    }

    const audiusTrackId = publishRes?.data?.audius_track_id || publishRes?.audius_track_id;
    const status = publishRes?.data?.status || 'pending';

    await base44.asServiceRole.entities.LiveSessionBundle.update(bundleId, {
      audius_track_id: audiusTrackId,
      audius_publish_status: status === 'success' ? 'success' : 'pending',
      audius_publish_error: '',
    });

    return Response.json({
      data: { bundle_id: bundleId, audius_track_id: audiusTrackId, status }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});