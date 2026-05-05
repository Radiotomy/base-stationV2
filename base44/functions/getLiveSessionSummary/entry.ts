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

    const messages = await base44.asServiceRole.entities.LiveChatMessage.filter({ session_id: sessionId }, '-created_date', 1000);
    const events = session?.state?.recentEvents || [];
    const participants = session?.state?.participants || [];

    const totalReactions = messages.filter(m => m.type === 'reaction').length;
    const totalChat = messages.filter(m => m.type === 'chat').length;

    // Aggregate event counts
    const eventCounts = events.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {});

    // Top fans by reaction + chat count
    const fanStats = {};
    for (const m of messages) {
      if (!m.user_id || m.user_id === session.user_id) continue;
      if (!fanStats[m.user_id]) {
        fanStats[m.user_id] = { user_id: m.user_id, user_name: m.user_name, reactions: 0, messages: 0, score: 0 };
      }
      if (m.type === 'reaction') { fanStats[m.user_id].reactions++; fanStats[m.user_id].score += 2; }
      else if (m.type === 'chat') { fanStats[m.user_id].messages++; fanStats[m.user_id].score += 1; }
    }
    const topFans = Object.values(fanStats).sort((a, b) => b.score - a.score).slice(0, 5);

    return Response.json({
      session_id: sessionId,
      title: session.title,
      duration_seconds: session.duration_seconds || 0,
      status: session.status,
      total_reactions: totalReactions,
      total_chat_messages: totalChat,
      total_messages: messages.length,
      total_participants: participants.length,
      peak_viewers: session.peak_viewers || 0,
      play_count: eventCounts.play || 0,
      pause_count: eventCounts.pause || 0,
      seek_count: eventCounts.seek || 0,
      tracks_used: session.tracks_used || [],
      top_fans: topFans,
      event_counts: eventCounts,
      events,
      participants,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});