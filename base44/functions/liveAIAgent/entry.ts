import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 4 — AI Co-Host agent.
 * Generates a contextual reaction, comment, or scene/track suggestion
 * and appends it to LiveSession.state.recentEvents.
 *
 * Payload: { sessionId, event: { type, payload } }
 *   event.type ∈ play | chat | reaction | scene-change
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId, event } = await req.json();
    if (!sessionId || !event?.type) {
      return Response.json({ error: 'sessionId and event.type required' }, { status: 400 });
    }

    const arr = await base44.entities.LiveSession.filter({ id: sessionId });
    const session = arr[0];
    if (!session || !session.ai_cohost_enabled) {
      return Response.json({ ok: false, reason: 'ai_cohost_disabled' });
    }

    // Decide AI event type
    const map = {
      play: 'ai-comment',
      chat: 'ai-reaction',
      reaction: 'ai-reaction',
      'scene-change': 'ai-scene-suggest',
    };
    const aiEventType = map[event.type] || 'ai-comment';

    // Lightweight LLM call
    const prompt = `You are an upbeat AI co-host on a live music stream titled "${session.title}". ` +
      `The performer is "${session.current_track_artist || 'an artist'}" playing "${session.current_track_title || 'a track'}". ` +
      `Just observed event: ${event.type} ${JSON.stringify(event.payload || {}).slice(0, 200)}. ` +
      `Reply with ONE short, fun, on-brand crowd-hyping line (max 14 words). No emojis at the start.`;

    let text = '';
    try {
      const llm = await base44.integrations.Core.InvokeLLM({ prompt });
      text = (typeof llm === 'string' ? llm : llm?.response || '').trim().slice(0, 200);
    } catch {
      text = 'The vibes are immaculate right now.';
    }

    const newEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: aiEventType,
      payload: { text, source: 'ai-cohost', triggeredBy: event.type },
      timestamp: new Date().toISOString(),
    };

    const events = session?.state?.recentEvents || [];
    await base44.entities.LiveSession.update(sessionId, {
      state: {
        ...(session.state || {}),
        recentEvents: [...events, newEvent].slice(-20),
      },
    });

    return Response.json({ ok: true, event: newEvent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});