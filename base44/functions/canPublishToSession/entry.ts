import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5.8 — Authorization gate for Streamr publishing.
 * Returns { allowed: boolean, reason? } based on:
 *   - session exists
 *   - audio_mode === 'streamr'
 *   - caller is the session owner (performer) OR an approved co-performer
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId } = await req.json();
    if (!sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.LiveSession.filter({ id: sessionId });
    const session = rows[0];
    if (!session) return Response.json({ allowed: false, reason: 'session_not_found' });

    const mode = session.audio_mode || session.state?.audio_mode || 'sync';
    if (mode !== 'streamr') return Response.json({ allowed: false, reason: 'audio_mode_not_streamr' });

    const isOwner = session.user_id === user.id;
    const participants = session.state?.participants || [];
    const isCoPerformer = participants.some(
      p => p.id === user.id && (p.role === 'co-performer' || p.type === 'performer')
    );

    return Response.json({ allowed: isOwner || isCoPerformer });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});