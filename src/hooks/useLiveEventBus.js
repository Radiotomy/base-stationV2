import { useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Audiograph-style Live Event Bus
 *
 * Subscribes to LiveSession entity changes and emits the newest event
 * from state.recentEvents to the provided callback.
 *
 * Provides publishEvent(type, payload) which appends to state.recentEvents
 * (capped at 20) and updates the LiveSession entity.
 *
 * Supported event types:
 *   join, leave, play, pause, seek, reaction, chat,
 *   performer-ready, performer-start, scene-change,
 *   ai-action, fan-xp
 */
export function useLiveEventBus(roomId, onEvent) {
  const lastEventIdRef = useRef(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Subscribe to LiveSession changes and emit only newest unseen event
  useEffect(() => {
    if (!roomId) return;
    const unsub = base44.entities.LiveSession.subscribe((evt) => {
      if (!evt.data || evt.data.id !== roomId) return;
      const events = evt.data?.state?.recentEvents;
      if (!Array.isArray(events) || events.length === 0) return;
      const newest = events[events.length - 1];
      if (newest && newest.id !== lastEventIdRef.current) {
        lastEventIdRef.current = newest.id;
        onEventRef.current?.(newest);
      }
    });
    return unsub;
  }, [roomId]);

  const publishEvent = useCallback(async (type, payload = {}) => {
    if (!roomId) return;

    const newEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    // Read current session state
    let currentSession;
    try {
      const results = await base44.entities.LiveSession.filter({ id: roomId });
      currentSession = results[0];
    } catch {
      currentSession = null;
    }

    const currentEvents = currentSession?.state?.recentEvents || [];
    const updatedEvents = [...currentEvents, newEvent].slice(-20); // cap at 20

    await base44.entities.LiveSession.update(roomId, {
      state: {
        ...(currentSession?.state || {}),
        recentEvents: updatedEvents,
      },
    });

    // Also publish to Intelligence OS event log (non-blocking, non-UI-blocking)
    const eventTypeMap = {
      'join': 'live_participant_join',
      'leave': 'live_participant_leave',
      'play': 'live_track_play',
      'pause': 'live_track_pause',
      'seek': 'live_track_seek',
      'reaction': 'live_reaction',
      'chat': 'live_chat_message',
      'scene-change': 'live_scene_change',
      'performer-ready': 'live_performer_ready',
      'performer-start': 'live_performer_start',
    };
    const analyticsType = eventTypeMap[type] || 'studio_visit';
    base44.functions.invoke('trackAnalytics', {
      event_type: analyticsType,
      session_id: roomId,
      event_data: { live_event: type, ...payload },
    }).catch(() => {});

    return newEvent;
  }, [roomId]);

  return { publishEvent };
}