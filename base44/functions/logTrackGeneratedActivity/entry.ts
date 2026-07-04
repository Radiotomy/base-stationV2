import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Entity automation handler: fires when a UserAsset track is created.
// Adds a "just generated" item to the Community Buzz activity feed.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const event = payload?.event;
    let data = payload?.data;

    if (!event || event.entity_name !== 'UserAsset') {
      return Response.json({ skipped: true, reason: 'not a UserAsset event' });
    }
    if (payload?.payload_too_large || !data) {
      data = await base44.asServiceRole.entities.UserAsset.get(event.entity_id);
    }
    if (!data || data.asset_type !== 'track') {
      return Response.json({ skipped: true, reason: 'not a track asset' });
    }

    // Resolve a display name for the creator
    let actorName = data.user_email ? data.user_email.split('@')[0] : 'A creator';
    if (data.user_id) {
      const users = await base44.asServiceRole.entities.User.filter({ id: data.user_id }).catch(() => []);
      if (users?.[0]?.full_name) actorName = users[0].full_name;
    }

    await base44.asServiceRole.entities.ActivityFeedItem.create({
      type: 'track_generated',
      actor_id: data.user_id || null,
      actor_name: actorName,
      title: `just generated a new track: "${data.title || 'Untitled'}"`,
      description: [data.metadata?.genre, data.metadata?.mood].filter(Boolean).join(' · '),
      thumbnail_url: data.thumbnail_url || null,
      entity_type: 'UserAsset',
      entity_id: event.entity_id,
    });

    return Response.json({ logged: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});