import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Triggered by entity automation when a TrackSubmission status changes to "approved".
// Notifies every follower of the artist by email and posts to the community activity feed.
// Payload: { event, data, old_data, changed_fields }

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Only the platform automation (platform auth) or an admin may trigger fan emails.
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    let track = body?.data;
    const event = body?.event;

    // payload_too_large fallback
    if (!track && event?.entity_id) {
      track = await base44.asServiceRole.entities.TrackSubmission.get(event.entity_id);
    }
    if (!track?.artist_id) {
      return Response.json({ error: 'Missing track data' }, { status: 400 });
    }
    if (track.status !== 'approved') {
      return Response.json({ skipped: true, reason: 'Track is not approved' });
    }

    const artistName = escapeHtml(track.artist_name || 'An artist you follow');
    const trackTitle = escapeHtml(track.title || 'a new track');
    const appId = Deno.env.get('BASE44_APP_ID');
    const artistUrl = `https://base44.app/apps/${appId}/artist/${track.artist_id}`;

    // Collect all followers (paginated)
    const followers = [];
    let skip = 0;
    while (true) {
      const page = await base44.asServiceRole.entities.Follow.filter(
        { following_id: track.artist_id }, '-created_date', 100, skip
      );
      followers.push(...page);
      if (page.length < 100) break;
      skip += 100;
    }

    // Post to the community activity feed
    await base44.asServiceRole.entities.ActivityFeedItem.create({
      type: 'track_submitted',
      actor_name: track.artist_name || 'Artist',
      actor_id: track.artist_id,
      actor_avatar_url: track.artist_avatar_url,
      title: `${track.artist_name || 'An artist'} just dropped "${track.title}"`,
      description: track.genre ? `New ${track.genre} track live on the charts now.` : 'New track live on the charts now.',
      entity_id: track.id || event?.entity_id,
      entity_type: 'TrackSubmission',
      link_url: `/artist/${track.artist_id}`,
      thumbnail_url: track.cover_image_url,
    });

    // Email each follower
    let sent = 0;
    for (const f of followers) {
      if (!f.follower_email) continue;
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: f.follower_email,
          from_name: 'Base Station',
          subject: `🎵 ${artistName} just dropped "${trackTitle}"`,
          body: `
            <h2 style="color:#FF9A4D">${artistName} released a new track! 🎵</h2>
            <p><strong>"${trackTitle}"</strong>${track.genre ? ` — ${escapeHtml(track.genre)}` : ''} is live on Base Station now.</p>
            <p><a href="${artistUrl}" style="display:inline-block;background:#FF9A4D;color:#14100C;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Listen Now</a></p>
            <br/>
            <p style="color:#888;font-size:12px">You're receiving this because you follow ${artistName} on Base Station.</p>
          `,
        });
        sent++;
      } catch (e) {
        console.error(`Failed to email ${f.follower_email}: ${e.message}`);
      }
    }

    console.log(`Track drop alert: ${track.artist_name} "${track.title}" — emailed ${sent}/${followers.length} followers`);
    return Response.json({ success: true, followers: followers.length, emails_sent: sent });
  } catch (error) {
    console.error('notifyFansTrackDrop error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});