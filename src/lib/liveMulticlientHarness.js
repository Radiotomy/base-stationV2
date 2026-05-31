/**
 * Multi-Client Simulation Harness for Live Performance Regression Tests
 *
 * Provides isolated performer + fan "clients" that drive real Base44 entity
 * reads/writes through the same code paths LiveStudio.jsx and LiveWatch.jsx use.
 * Each client maintains local state mirroring its real-UI counterpart.
 */

import { base44 } from '@/api/base44Client';

// ---------- Asserts ----------

export class AssertError extends Error {
  constructor(msg) { super(msg); this.name = 'AssertError'; }
}

export function assert(cond, message) {
  if (!cond) throw new AssertError(message || 'assert failed');
}

export function assertEqual(a, b, message) {
  if (a !== b) throw new AssertError(`${message || 'assertEqual'} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

export function assertDeepEqual(a, b, message) {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) throw new AssertError(`${message || 'assertDeepEqual'} — expected ${sb}, got ${sa}`);
}

// ---------- Local-storage keys (mirrors LiveWatch convention) ----------

export const FAN_PREF_KEY = (sessionId) => `live:fanVisualPreference:${sessionId}`;

// ---------- Shared sleep ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Event helper: wait until every client has seen `eventType` ----------

export async function awaitEventOnAllClients(clients, eventType, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await Promise.all(clients.map((c) => c.refresh()));
    const allHave = clients.every((c) => c.hasSeenEvent(eventType));
    if (allHave) return;
    await sleep(150);
  }
  throw new AssertError(`timeout: not all clients saw "${eventType}" within ${timeoutMs}ms`);
}

// ---------- Performer client ----------

export async function createPerformerClient({ title = 'Multi-Client Test', audio_mode = 'sync' } = {}) {
  const res = await base44.functions.invoke('createLiveSession', { title, audio_mode });
  const sessionId = res.data?.session_id;
  if (!sessionId) throw new Error('createLiveSession returned no session_id');

  const client = {
    role: 'performer',
    sessionId,
    state: { nowPlaying: null, status: 'draft' },
    lastToast: null,
  };

  // Read+merge helper, used by every state mutation (matches LiveStudio.buildStateUpdate).
  const buildStateUpdate = async (patch) => {
    const cur = (await base44.entities.LiveSession.filter({ id: sessionId }))[0]?.state || {};
    return { ...cur, ...patch };
  };

  // Append a transient event to state.recentEvents (matches LiveStudio.safePublish).
  const publishEvent = async (type, payload) => {
    const cur = (await base44.entities.LiveSession.filter({ id: sessionId }))[0]?.state || {};
    const newEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
    };
    const recentEvents = [...(cur.recentEvents || []), newEvent].slice(-20);
    await base44.entities.LiveSession.update(sessionId, {
      state: { ...cur, recentEvents },
    });
  };

  client.start = async () => {
    await base44.entities.LiveSession.update(sessionId, {
      status: 'streaming',
      start_time: new Date().toISOString(),
    });
    client.state.status = 'streaming';
  };

  client.selectTrack = async (track) => {
    const np = {
      trackId: track.id,
      title: track.title,
      track_url: track.file_url || '',
      position_ms: 0,
      isPlaying: false,
      updated_at: new Date().toISOString(),
    };
    const newState = await buildStateUpdate({ nowPlaying: np });
    await base44.entities.LiveSession.update(sessionId, {
      current_track_title: track.title,
      state: newState,
    });
    await publishEvent('track-change', { trackId: track.id, title: track.title, position_ms: 0 });
    client.state.nowPlaying = np;
  };

  client.play = async (positionMs) => {
    const np = { ...(client.state.nowPlaying || {}), isPlaying: true, position_ms: positionMs };
    const newState = await buildStateUpdate({ nowPlaying: np });
    await base44.entities.LiveSession.update(sessionId, { state: newState });
    await publishEvent('play', { position_ms: positionMs });
    client.state.nowPlaying = np;
  };

  client.pause = async (positionMs) => {
    const np = { ...(client.state.nowPlaying || {}), isPlaying: false, position_ms: positionMs };
    const newState = await buildStateUpdate({ nowPlaying: np });
    await base44.entities.LiveSession.update(sessionId, { state: newState });
    await publishEvent('pause', { position_ms: positionMs });
    client.state.nowPlaying = np;
  };

  client.seek = async (positionMs) => {
    const np = { ...(client.state.nowPlaying || {}), position_ms: positionMs };
    const newState = await buildStateUpdate({ nowPlaying: np });
    await base44.entities.LiveSession.update(sessionId, { state: newState });
    await publishEvent('seek', { position_ms: positionMs });
    client.state.nowPlaying = np;
  };

  // Mirrors PortalsToggle.handleEnable: optimistic update + analytics flag.
  client.enablePortals = async (portalRoomId) => {
    await base44.entities.LiveSession.update(sessionId, {
      visual_layer: 'portals',
      portal_room_id: portalRoomId,
      visual_layer_analytics: {
        visual_layer_enabled_by_creator: true,
        fan_visual_layer_choices: { standard: 0, portals: 0 },
        portals_load_failures: 0,
        total_time_in_3d_ms: 0,
      },
    });
    client.lastToast = 'Portals Stage Enabled';
  };

  // Mirrors PortalsToggle.handleEnable failure path: revert and notify.
  client.enablePortalsWithFailure = async () => {
    // Optimistic flip
    await base44.entities.LiveSession.update(sessionId, { visual_layer: 'portals' });
    // Simulated createPortalRoom failure → revert
    await base44.entities.LiveSession.update(sessionId, {
      visual_layer: 'visualizer',
      portal_room_id: null,
    });
    client.lastToast = 'Portals failed to load. Reverting to Visualizer.';
  };

  client.disablePortals = async () => {
    await base44.entities.LiveSession.update(sessionId, {
      visual_layer: 'visualizer',
      portal_room_id: null,
    });
    client.lastToast = 'Portals Stage Disabled';
  };

  client.end = async () => {
    await base44.entities.LiveSession.update(sessionId, {
      status: 'completed',
      end_time: new Date().toISOString(),
    });
    await publishEvent('session-end', { performerId: 'perf' });
    client.state.status = 'completed';
  };

  return client;
}

// ---------- Fan client ----------

export async function createFanClient(index, sessionId) {
  // Local state mirrors LiveWatch's component state.
  const client = {
    role: 'fan',
    index,
    sessionId,
    state: { nowPlaying: null, participants: [], recentEvents: [] },
    seenEventIds: new Set(),
    derived: {
      portalsAvailable: false,
      fanVisualPreference: 'standard',
      shouldRenderPortalStage: false,
      shouldRenderVisualizer: false,
    },
    fallbackToastShown: false,
    unmounted: false,
  };

  // Initial sync — read session + restore persisted fan preference for this session.
  await client.refresh?.(); // safe even before assignment

  client.refresh = async () => {
    if (client.unmounted) return;
    const rows = await base44.entities.LiveSession.filter({ id: sessionId });
    const s = rows[0];
    if (!s) return;
    client.state.nowPlaying = s.state?.nowPlaying || null;
    client.state.participants = s.state?.participants || [];
    client.state.recentEvents = s.state?.recentEvents || [];
    client.state.status = s.status;

    // Record any new event ids
    client.state.recentEvents.forEach((e) => client.seenEventIds.add(`${e.type}:${e.id}`));

    // Derive Portals availability (matches LiveWatch logic).
    const portalsAvailable = s.visual_layer === 'portals' && !!s.portal_room_id;
    client.derived.portalsAvailable = portalsAvailable;

    // Load persisted preference (mirrors LiveWatch localStorage logic).
    const persisted = localStorage.getItem(FAN_PREF_KEY(sessionId));
    if (persisted === 'portals' || persisted === 'standard') {
      client.derived.fanVisualPreference = persisted;
    }
    // Auto-revert if creator disabled Portals mid-session
    if (!portalsAvailable && client.derived.fanVisualPreference === 'portals') {
      client.derived.fanVisualPreference = 'standard';
      localStorage.setItem(FAN_PREF_KEY(sessionId), 'standard');
    }
    client.derived.shouldRenderPortalStage =
      portalsAvailable && client.derived.fanVisualPreference === 'portals';
    client.derived.shouldRenderVisualizer = !client.derived.shouldRenderPortalStage;
  };

  client.hasSeenEvent = (type) => {
    // For sync purposes, check recentEvents currently loaded
    return (client.state.recentEvents || []).some((e) => e.type === type);
  };

  // Mirrors FanVisualLayerSelector.onChange → also writes choice into analytics.
  client.setFanVisualPreference = (pref) => {
    client.derived.fanVisualPreference = pref;
    localStorage.setItem(FAN_PREF_KEY(sessionId), pref);
    client.derived.shouldRenderPortalStage =
      client.derived.portalsAvailable && pref === 'portals';
    client.derived.shouldRenderVisualizer = !client.derived.shouldRenderPortalStage;
    // Record analytics (fire-and-forget)
    writeChoiceAnalytics(sessionId, pref).catch(() => {});
  };

  // Mirrors PortalStageViewer onError → fallback path in LiveWatch.
  client.simulatePortalsLoadFailure = async () => {
    client.fallbackToastShown = true;
    client.derived.fanVisualPreference = 'standard';
    localStorage.setItem(FAN_PREF_KEY(sessionId), 'standard');
    client.derived.shouldRenderPortalStage = false;
    client.derived.shouldRenderVisualizer = true;
    await incrementFailureCounter(sessionId);
  };

  client.simulateDwellMs = async (ms) => {
    await addDwellMs(sessionId, ms);
  };

  client.join = async () => {
    const rows = await base44.entities.LiveSession.filter({ id: sessionId });
    const s = rows[0];
    const participants = s.state?.participants || [];
    if (!participants.some((p) => p.id === `fan-${index}`)) {
      const updated = [...participants, { id: `fan-${index}`, displayName: `Fan ${index}`, type: 'fan' }];
      await base44.entities.LiveSession.update(sessionId, {
        state: { ...(s.state || {}), participants: updated },
      });
    }
  };

  client.unmount = () => {
    client.unmounted = true;
  };

  // Initial state load
  await client.refresh();

  // Clear stale prefs from prior runs on first creation of a brand-new session,
  // but ONLY if no persisted value exists for THIS session.
  if (!localStorage.getItem(FAN_PREF_KEY(sessionId))) {
    client.derived.fanVisualPreference = 'standard';
  }

  return client;
}

// ---------- Analytics writers (mirrors what UI would do) ----------

async function writeChoiceAnalytics(sessionId, pref) {
  const s = (await base44.entities.LiveSession.filter({ id: sessionId }))[0];
  if (!s) return;
  const a = s.visual_layer_analytics || {
    visual_layer_enabled_by_creator: false,
    fan_visual_layer_choices: { standard: 0, portals: 0 },
    portals_load_failures: 0,
    total_time_in_3d_ms: 0,
  };
  const choices = { ...(a.fan_visual_layer_choices || { standard: 0, portals: 0 }) };
  choices[pref] = (choices[pref] || 0) + 1;
  await base44.entities.LiveSession.update(sessionId, {
    visual_layer_analytics: { ...a, fan_visual_layer_choices: choices },
  });
}

async function incrementFailureCounter(sessionId) {
  const s = (await base44.entities.LiveSession.filter({ id: sessionId }))[0];
  if (!s) return;
  const a = s.visual_layer_analytics || {
    visual_layer_enabled_by_creator: false,
    fan_visual_layer_choices: { standard: 0, portals: 0 },
    portals_load_failures: 0,
    total_time_in_3d_ms: 0,
  };
  await base44.entities.LiveSession.update(sessionId, {
    visual_layer_analytics: {
      ...a,
      portals_load_failures: (a.portals_load_failures || 0) + 1,
    },
  });
}

async function addDwellMs(sessionId, ms) {
  const s = (await base44.entities.LiveSession.filter({ id: sessionId }))[0];
  if (!s) return;
  const a = s.visual_layer_analytics || {
    visual_layer_enabled_by_creator: false,
    fan_visual_layer_choices: { standard: 0, portals: 0 },
    portals_load_failures: 0,
    total_time_in_3d_ms: 0,
  };
  await base44.entities.LiveSession.update(sessionId, {
    visual_layer_analytics: {
      ...a,
      total_time_in_3d_ms: (a.total_time_in_3d_ms || 0) + ms,
    },
  });
}

// ---------- Cleanup ----------

export async function cleanupSession(sessionId) {
  // Wipe persisted fan prefs for this session
  try {
    Object.keys(localStorage)
      .filter((k) => k.includes(`:${sessionId}`))
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
  await base44.entities.LiveSession.delete(sessionId).catch(() => {});
}