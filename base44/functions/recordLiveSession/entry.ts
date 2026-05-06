import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId } = await req.json();
    if (!sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });

    const sessions = await base44.asServiceRole.entities.LiveSession.filter({ id: sessionId });
    const session = sessions[0];
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

    // Only the performer can record
    if (session.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const messages = await base44.asServiceRole.entities.LiveChatMessage.filter({ session_id: sessionId }, 'created_date', 5000);
    const events = session?.state?.recentEvents || [];

    // Compute summary stats inline
    const totalReactions = messages.filter(m => m.type === 'reaction').length;
    const totalChat = messages.filter(m => m.type === 'chat').length;

    const fanStats = {};
    for (const m of messages) {
      if (!m.user_id || m.user_id === session.user_id) continue;
      if (!fanStats[m.user_id]) fanStats[m.user_id] = { user_id: m.user_id, user_name: m.user_name, score: 0 };
      fanStats[m.user_id].score += m.type === 'reaction' ? 2 : 1;
    }
    const topFans = Object.values(fanStats).sort((a, b) => b.score - a.score).slice(0, 5);

    // Upload event log JSON
    const eventBlob = new Blob([JSON.stringify({ session_id: sessionId, events }, null, 2)], { type: 'application/json' });
    const eventFile = new File([eventBlob], `live-events-${sessionId}.json`, { type: 'application/json' });
    const { file_url: event_log_url } = await base44.integrations.Core.UploadFile({ file: eventFile });

    // Upload chat log JSON
    const chatBlob = new Blob([JSON.stringify({ session_id: sessionId, messages }, null, 2)], { type: 'application/json' });
    const chatFile = new File([chatBlob], `live-chat-${sessionId}.json`, { type: 'application/json' });
    const { file_url: chat_log_url } = await base44.integrations.Core.UploadFile({ file: chatFile });

    const bundle = await base44.asServiceRole.entities.LiveSessionBundle.create({
      session_id: sessionId,
      performer_id: session.user_id,
      performer_email: session.user_email,
      title: session.title,
      mixdown_url: null,
      event_log_url,
      chat_log_url,
      metadata: {
        duration_seconds: session.duration_seconds || 0,
        peak_viewers: session.peak_viewers || 0,
        total_reactions: totalReactions,
        total_chat_messages: totalChat,
        total_messages: messages.length,
        tracks_used: session.tracks_used || [],
        top_fans: topFans,
        audio_mode: session.audio_mode || session.state?.audio_mode || 'sync',
      },
    });

    return Response.json({ bundle_id: bundle.id, event_log_url, chat_log_url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});