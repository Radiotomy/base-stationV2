// Shared Portals (theportal.to) API helpers for BASE Station Live Studio venues.
//
// Hybrid ownership model:
//   A creator may connect their OWN Portals access key (they own a Portals Real
//   Estate NFT). When present, rooms are created under THEIR account so the
//   venue belongs to their wallet. When absent we fall back to the platform key.
//   resolveAccessKey() is the single place that decision is made — every caller
//   goes through it so a creator-owned venue can never be silently re-parented
//   to the platform account.
//
// The platform key and any creator key are server-side only. They are never
// returned to a client: callers get { ownership, configured } instead.

import { secrets } from 'base44:runtime';

export const PORTAL_BASE = 'https://theportal.to/api/v2';

// Read lazily inside calls — resolving a secret at module scope would run before
// any handler's try/catch and turn a missing key into an unlogged boot error.
function platformKey() {
  return secrets.get('PORTAL_ACCESS_KEY') || '';
}

export type PortalOwnership = 'platform' | 'creator';

export interface ResolvedKey {
  key: string;
  ownership: PortalOwnership;
  uid: string | null;
}

export function accessHeaders(key: string, extra: Record<string, string> = {}) {
  return { 'Content-Type': 'application/json', 'x-access-key': key, ...extra };
}

export function apiKeyHeaders(key: string) {
  return { 'Content-Type': 'application/json', 'x-api-key': key };
}

export function roomUrl(roomId: string) {
  return `https://theportal.to/?room=${roomId}`;
}

/**
 * Validate an access key against Portals and return the owning Firebase uid.
 * Used both for the platform health check and to verify a creator's own key
 * before we store it — an unverified key would fail later at room-create time
 * with a confusing error, so we reject it at connect time instead.
 */
export async function verifyKey(key: string): Promise<{ valid: boolean; uid: string | null; error?: string }> {
  if (!key) return { valid: false, uid: null, error: 'No access key provided' };
  try {
    const res = await fetch(`${PORTAL_BASE}/mcp/verify-access-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessKey: key }),
    });
    if (!res.ok) return { valid: false, uid: null, error: `Key rejected by Portals (HTTP ${res.status})` };
    const data = await res.json();
    return { valid: true, uid: data?.data?.uid || null };
  } catch (err) {
    return { valid: false, uid: null, error: (err as Error).message };
  }
}

/**
 * Decide which Portals account a given creator's operations run under.
 * A stored, previously-verified creator credential wins; otherwise the platform
 * key. Throws only when neither exists, because every downstream call needs one.
 */
export async function resolveAccessKey(base44: any, userId: string): Promise<ResolvedKey> {
  try {
    const rows = await base44.asServiceRole.entities.PortalCredential.filter({
      user_id: userId,
      status: 'connected',
    });
    const cred = rows?.[0];
    if (cred?.access_key) {
      return { key: cred.access_key, ownership: 'creator', uid: cred.portal_uid || null };
    }
  } catch {
    // Credential lookup failure must not break venue creation — fall through
    // to the platform key rather than blocking the creator entirely.
  }
  const pk = platformKey();
  if (!pk) throw new Error('Portals is not configured for this app');
  return { key: pk, ownership: 'platform', uid: null };
}

export function platformConfigured() {
  return !!platformKey();
}

/**
 * Resolve the key that owns a specific venue. A venue created under a creator's
 * own account can only be modified with that same key, so we key off the venue's
 * recorded ownership rather than the caller's current credential state — a
 * creator who disconnects their key must not lose the ability to read the venue,
 * and we must never attempt a platform-key write against a creator-owned room.
 */
export async function resolveKeyForVenue(base44: any, venue: any): Promise<ResolvedKey> {
  if (venue?.ownership === 'creator') {
    const rows = await base44.asServiceRole.entities.PortalCredential.filter({
      user_id: venue.user_id,
      status: 'connected',
    });
    const cred = rows?.[0];
    if (!cred?.access_key) {
      throw new Error('This venue is owned by your Portals account, but that connection is no longer active. Reconnect your Portals key to manage it.');
    }
    return { key: cred.access_key, ownership: 'creator', uid: cred.portal_uid || null };
  }
  const pk = platformKey();
  if (!pk) throw new Error('Portals is not configured for this app');
  return { key: pk, ownership: 'platform', uid: null };
}

// ── Room data ────────────────────────────────────────────────────────────────

export async function downloadRoomData(roomId: string, key: string) {
  const res = await fetch(`${PORTAL_BASE}/mcp/download-room-data`, {
    headers: { 'x-room-id': roomId, 'x-access-key': key },
  });
  if (!res.ok) throw new Error(`Could not read the Portals room (HTTP ${res.status})`);
  return await res.json();
}

export async function uploadRoomData(roomId: string, key: string, roomData: unknown) {
  const signRes = await fetch(`${PORTAL_BASE}/utils/generate-json-upload-url`, {
    method: 'POST',
    headers: apiKeyHeaders(key),
    body: JSON.stringify({ fileName: `basestation-venue-${roomId}-${Date.now()}.json` }),
  });
  if (!signRes.ok) throw new Error(`Signed URL failed: ${await signRes.text()}`);
  const { signedUploadURL, assetURL } = await signRes.json();

  const putRes = await fetch(signedUploadURL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(roomData),
  });
  if (!putRes.ok) throw new Error(`Room JSON upload failed (HTTP ${putRes.status})`);

  const loadRes = await fetch(`${PORTAL_BASE}/mcp/upload-room-data-url`, {
    method: 'POST',
    headers: accessHeaders(key, { 'x-room-id': roomId }),
    body: JSON.stringify({ jsonUrl: assetURL }),
  });
  if (!loadRes.ok) throw new Error(`Room data load failed: ${await loadRes.text()}`);
}

// ── Settings ─────────────────────────────────────────────────────────────────

/**
 * Post a settings patch to Portals. Keys are passed through exactly as given so
 * callers can use the documented dotted paths (e.g. 'settings.welcomeEmbed',
 * 'room.LoadingImages') without this helper needing to know every space option.
 */
export async function setRoomSettings(roomId: string, key: string, patch: Record<string, unknown>) {
  const res = await fetch(`${PORTAL_BASE}/room/update-room-settings`, {
    method: 'POST',
    headers: accessHeaders(key),
    body: JSON.stringify({ RoomID: roomId, ...patch }),
  });
  if (!res.ok) throw new Error(`Portals rejected the settings update: ${await res.text()}`);
  return true;
}

export async function createRoom(key: string, templateName: string, name: string) {
  const res = await fetch(`${PORTAL_BASE}/rooms/create`, {
    method: 'POST',
    headers: accessHeaders(key),
    body: JSON.stringify({
      templateName: templateName || 'blank',
      customTemplateName: name.slice(0, 60),
    }),
  });
  if (!res.ok) throw new Error(`Portals room create failed: ${await res.text()}`);
  const data = await res.json();
  // Portals nests the room under `room` and names the joinable id `RoomID` (a
  // UUID) — distinct from `room.id`, which is the internal document id and does
  // NOT work in ?room=. Accept the flat shape too in case the response changes.
  const roomId = data?.room?.RoomID || data?.RoomID || data?.roomId;
  if (!roomId) throw new Error(`Portals did not return a room id: ${JSON.stringify(data).slice(0, 300)}`);
  return roomId as string;
}