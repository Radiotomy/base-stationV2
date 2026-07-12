import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Triggered by entity automation when a LiveSession status changes to "streaming".
// Notifies every follower of the artist by email and posts to the community activity feed.
// Payload: { event, data, old_data, changed_fields }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Reject unauthenticated direct calls — only the platform automation
    // (which invokes with platform auth) or an admin may trigger fan emails.
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();

    let session = body?.data;
    const event = body?.event;

    // payload_too_large fallback
    if (!session && event?.entity_id) {
      session = await base44.asServiceRole.entities.LiveSession.get(event.entity_id);
    }
    if (!session?.user_id) {
      return Response.json({ error: 'Missing session data' }, { status: 400 });
    }
    if (session.status !== 'streaming') {
      return Response.json({ skipped: true, reason: 'Session is not streaming' });
    }

    const sessionId = session.id || event?.entity_id;
    const appId = Deno.env.get('BASE44_APP_ID');
    const watchUrl = `https://base44.app/apps/${appId}/live-watch?roomId=${sessionId}`;

    // Resolve artist display name
    let artistName = 'An artist you follow';
    try {
      const artists = await base44.asServiceRole.entities.User.filter({ id: session.user_id });
      if (artists[0]?.full_name) artistName = artists[0].full_name;
    } catch (_) { /* artist lookup is best-effort */ }

    // Collect all followers (paginated)
    const followers = [];
    let skip = 0;
    while (true) {
      const page = await base44.asServiceRole.entities.Follow.filter(
        { following_id: session.user_id }, '-created_date', 100, skip
      );
      followers.push(...page);
      if (page.length < 100) break;
      skip += 100;
    }

    // Post to the community activity feed
    await base44.asServiceRole.entities.ActivityFeedItem.create({
      type: 'session_started',
      actor_name: artistName,
      actor_id: session.user_id,
      title: `${artistName} is LIVE now!`,
      description: session.title ? `Performing "${session.title}" — join the room and watch live.` : 'Join the room and watch live.',
      entity_id: sessionId,
      entity_type: 'LiveSession',
      link_url: `/live-watch?roomId=${sessionId}`,
    });

    // Email each follower
    let sent = 0;
    for (const f of followers) {
      if (!f.follower_email) continue;
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: f.follower_email,
          from_name: 'Base Station',
          subject: `🔴 ${artistName} is LIVE right now!`,
          body: `
            <h2 style="color:#a855f7">${artistName} just went live! 🎤</h2>
            <p>${session.title ? `They're performing <strong>"${session.title}"</strong> right now.` : 'They\'re performing right now.'}</p>
            ${session.visual_layer === 'portals' ? '<p>🌐 This show has an immersive <strong>3D venue</strong> — walk in with your avatar!</p>' : ''}
            <p><a href="${watchUrl}" style="display:inline-block;background:#a855f7;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Join the Live Session</a></p>
            <br/>
            <p style="color:#888;font-size:12px">You're receiving this because you follow ${artistName} on Base Station.</p>
          `,
        });
        sent++;
      } catch (e) {
        console.error(`Failed to email ${f.follower_email}: ${e.message}`);
      }
    }

    console.log(`Live alert: ${artistName} (session ${sessionId}) — emailed ${sent}/${followers.length} followers`);
    return Response.json({ success: true, followers: followers.length, emails_sent: sent });
  } catch (error) {
    console.error('notifyFansLiveStart error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});