import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Entity automation handler: fires when a UserAsset track OR a LoopSample is
// created. Adds a "just generated" item to the Community Buzz activity feed.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const event = payload?.event;
    let data = payload?.data;

    // Entity-create automation payload: { event: { entity_name, entity_id }, data }.
    // Base44 automations fire without a guaranteed user JWT (automation runtime ==
    // direct HTTP), so the automation event shape is allowed to proceed under
    // service-role. Direct HTTP calls lacking the event shape are rejected with
    // 403 — same surgical gate as autoBaseMarkV2: the automation contract is
    // honored, but external callers can't drive the function directly.
    if (!event || (event.entity_name !== 'UserAsset' && event.entity_name !== 'LoopSample')) {
      return Response.json({ error: 'Forbidden: automation event payload required' }, { status: 403 });
    }
    if (payload?.payload_too_large || !data) {
      data = await base44.asServiceRole.entities[event.entity_name].get(event.entity_id);
    }

    const isLoop = event.entity_name === 'LoopSample';
    if (!isLoop && data?.asset_type !== 'track') {
      return Response.json({ skipped: true, reason: 'not a track asset' });
    }
    if (!data) return Response.json({ skipped: true, reason: 'no data' });

    // Resolve a display name for the creator
    let actorName = data.user_name || (data.user_email ? data.user_email.split('@')[0] : 'A creator');
    if (data.user_id) {
      const users = await base44.asServiceRole.entities.User.filter({ id: data.user_id }).catch(() => []);
      if (users?.[0]?.full_name) actorName = users[0].full_name;
    }

    if (isLoop) {
      const descParts = [data.category, data.bpm ? `${data.bpm} BPM` : null, data.source === 'soundforge' ? 'BASE SoundForge' : null].filter(Boolean);
      await base44.asServiceRole.entities.ActivityFeedItem.create({
        type: 'loop_generated',
        actor_id: data.user_id || null,
        actor_name: actorName,
        title: `just generated a new loop/sample: "${data.title || 'Untitled'}"`,
        description: descParts.join(' · '),
        entity_type: 'LoopSample',
        entity_id: event.entity_id,
        metadata: {
          category: data.category || '',
          source: data.source || '',
          bpm: data.bpm || '',
        },
      });
      return Response.json({ logged: true });
    }

    // Surface the actual AI model used (e.g. "Lyria 3 Pro") — not the
    // provider (e.g. "Tempolor") — so community transparency shows the real model.
    const model = data.metadata?.model || '';
    const descParts = [model, data.metadata?.genre, data.metadata?.mood].filter(Boolean);

    await base44.asServiceRole.entities.ActivityFeedItem.create({
      type: 'track_generated',
      actor_id: data.user_id || null,
      actor_name: actorName,
      title: `just generated a new track: "${data.title || 'Untitled'}"`,
      description: descParts.join(' · '),
      thumbnail_url: data.thumbnail_url || null,
      entity_type: 'UserAsset',
      entity_id: event.entity_id,
      metadata: {
        model,
        provider: data.metadata?.provider || '',
        genre: data.metadata?.genre || '',
        mood: data.metadata?.mood || '',
      },
    });

    return Response.json({ logged: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});