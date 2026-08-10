import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ORVO Phase 5 — async collaboration: co-host/guest invites + guest recording submission.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // ── Public: resolve a guest link token ──
    if (action === 'resolve') {
      const token = String(body.token || '');
      if (!token) return Response.json({ error: 'Missing token' }, { status: 400 });
      const rows = await base44.asServiceRole.entities.OrvoCollaboration.filter({ guest_link_token: token });
      const collab = rows?.[0];
      if (!collab || collab.status === 'revoked') {
        return Response.json({ error: 'This invite link is no longer valid.' }, { status: 404 });
      }
      const pods = await base44.asServiceRole.entities.Podcast.filter({ id: collab.podcast_id });
      const pod = pods?.[0];
      return Response.json({
        collaboration: { id: collab.id, role: collab.role, status: collab.status, podcast_id: collab.podcast_id },
        podcast: pod ? { id: pod.id, title: pod.title, cover_image: pod.cover_image, user_name: pod.user_name } : null,
      });
    }

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── Guest submits a take against a valid invite link ──
    if (action === 'submitRecording') {
      const token = String(body.token || '');
      const rows = await base44.asServiceRole.entities.OrvoCollaboration.filter({ guest_link_token: token });
      const collab = rows?.[0];
      if (!collab || collab.status === 'revoked') {
        return Response.json({ error: 'This invite link is no longer valid.' }, { status: 403 });
      }
      if (!body.audio_url) return Response.json({ error: 'Missing audio_url' }, { status: 400 });

      const recording = await base44.asServiceRole.entities.Recording.create({
        user_id: collab.owner_id,
        podcast_id: collab.podcast_id,
        title: body.title || `Guest take — ${user.full_name || user.email}`,
        audio_url: body.audio_url,
        duration_seconds: body.duration_seconds || 0,
        source: 'guest_link',
        status: 'ready',
        notes: `Submitted by ${user.full_name || user.email} (${user.email})`,
      });

      if (collab.status === 'pending') {
        await base44.asServiceRole.entities.OrvoCollaboration.update(collab.id, {
          status: 'accepted',
          collaborator_user_id: user.id,
        });
      }
      return Response.json({ recording });
    }

    // ── Owner-only actions below ──
    const podcastId = String(body.podcast_id || '');
    if (!podcastId) return Response.json({ error: 'Missing podcast_id' }, { status: 400 });
    const pods = await base44.asServiceRole.entities.Podcast.filter({ id: podcastId });
    const podcast = pods?.[0];
    if (!podcast) return Response.json({ error: 'Podcast not found' }, { status: 404 });
    if (podcast.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (action === 'list') {
      const collabs = await base44.asServiceRole.entities.OrvoCollaboration.filter({ podcast_id: podcastId }, '-created_date', 50);
      const recordings = await base44.asServiceRole.entities.Recording.filter({ podcast_id: podcastId, source: 'guest_link' }, '-created_date', 50);
      return Response.json({ collaborations: collabs || [], recordings: recordings || [] });
    }

    if (action === 'invite') {
      const email = String(body.collaborator_email || '').trim().toLowerCase();
      if (!email) return Response.json({ error: 'Missing collaborator_email' }, { status: 400 });
      const token = crypto.randomUUID().replace(/-/g, '');
      const collab = await base44.asServiceRole.entities.OrvoCollaboration.create({
        owner_id: user.id,
        podcast_id: podcastId,
        collaborator_email: email,
        role: body.role || 'guest',
        status: 'pending',
        guest_link_token: token,
      });
      return Response.json({ collaboration: collab });
    }

    if (action === 'revoke') {
      const collabId = String(body.collaboration_id || '');
      if (!collabId) return Response.json({ error: 'Missing collaboration_id' }, { status: 400 });
      const updated = await base44.asServiceRole.entities.OrvoCollaboration.update(collabId, { status: 'revoked' });
      return Response.json({ collaboration: updated });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}