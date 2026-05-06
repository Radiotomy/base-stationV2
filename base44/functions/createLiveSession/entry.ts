import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { title, description, tags = [], audio_mode } = await req.json();
    if (!title) return Response.json({ error: 'Missing title' }, { status: 400 });

    // Phase 5.6 — validate audio_mode (default sync)
    let mode = audio_mode === 'streamr' ? 'streamr' : 'sync';
    // If streamr requested but not configured, fall back to sync
    if (mode === 'streamr' && !Deno.env.get('STREAMR_PRIVATE_KEY')) {
      mode = 'sync';
    }

    const session = await base44.asServiceRole.entities.LiveSession.create({
      user_id: user.id,
      user_email: user.email,
      title,
      description,
      status: 'draft',
      tags,
      recording_enabled: true,
      viewer_count: 0,
      peak_viewers: 0,
      audio_mode: mode,
      streamr_enabled: mode === 'streamr',
      state: { audio_mode: mode },
    });

    // Non-blocking analytics
    base44.functions.invoke('trackAnalytics', {
      event_type: 'live_session_started',
      session_id: session.id,
      event_data: { phase: 'created', audio_mode: mode },
    }).catch(() => {});

    return Response.json({
      session_id: session.id,
      title: session.title,
      status: session.status,
      audio_mode: session.audio_mode,
      audio_mode_fallback: audio_mode === 'streamr' && mode === 'sync',
      created_at: session.created_date
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});