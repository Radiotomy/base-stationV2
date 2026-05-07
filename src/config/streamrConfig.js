// Phase 5.8 — Centralized Streamr config (browser-safe values only).
// Server-only secrets live in environment variables (STREAMR_PRIVATE_KEY,
// STREAMR_API_BASE) and are never imported here.
export const STREAMR_CONFIG = {
  streamIdPrefix: 'live-session-',
  // Polling interval (ms) for the fan-side relay subscriber.
  subscribePollMs: 1000,
  // Approximate publisher chunk duration (ms).
  publishChunkMs: 1000,
};

export function getStreamIdForSession(sessionId) {
  return `${STREAMR_CONFIG.streamIdPrefix}${sessionId}`;
}