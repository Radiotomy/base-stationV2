// Phase 6 — Streamr browser-direct live audio config (browser-safe values).
// The Streamr owner private key lives ONLY server-side (STREAMR_PRIVATE_KEY)
// and is read by the streamrAcquireStream backend function.
export const STREAMR_CONFIG = {
  // Publisher emits ~50ms Float32 PCM frames over the Streamr p2p network.
  frameTargetMs: 50,
  // Stream path under the configured owner address: 0xOWNER/basestation/live/<roomId>
  streamPathPrefix: '/basestation/live/',
};

export function getStreamPath(roomId) {
  return `${STREAMR_CONFIG.streamPathPrefix}${roomId}`;
}

// Backward-compatible helper kept for any existing importers (informational only;
// the true stream id is owned-address-prefixed and resolved server-side).
export function getStreamIdForSession(sessionId) {
  return `${STREAMR_CONFIG.streamPathPrefix}${sessionId}`;
}