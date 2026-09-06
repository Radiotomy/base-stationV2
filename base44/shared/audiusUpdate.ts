/**
 * Metadata-only edits to a track that is ALREADY live on Audius.
 *
 * Why this is not just "upload again": re-uploading would create a second release
 * of the same recording, which is exactly the thing a provenance system must not
 * do. A corrected COS score or disclosure label has to reach the existing release.
 *
 * Two behaviours here are deliberate and are the whole reason this file exists:
 *
 * 1. READ-MERGE-WRITE. Audius' update replaces the track's metadata, so sending
 *    only the fields we changed would blank the title, genre and artwork the
 *    creator may have edited on Audius itself. The live record is fetched first and
 *    our corrections are laid over it, so an edit narrows to what it claims to change.
 * 2. OWNERSHIP IS VERIFIED AGAINST THE LIVE TRACK, not against our own database. A
 *    stored audius_track_id could be stale or point at somebody else's release; the
 *    only trustworthy statement of who owns a track is Audius' own answer.
 */

import * as audiusSdkPkg from 'npm:@audius/sdk@9.1.0/dist/index.cjs.js';
const sdk = audiusSdkPkg.sdk || audiusSdkPkg.default?.sdk;

const AUDIUS_API = 'https://api.audius.co/v1';

/** The live release as Audius currently holds it. */
async function fetchLiveTrack({ apiKey, trackId }) {
  const url = new URL(`${AUDIUS_API}/tracks/${encodeURIComponent(trackId)}`);
  if (apiKey) url.searchParams.set('api_key', apiKey);
  else url.searchParams.set('app_name', 'BaseStation');
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  const json = await res.json().catch(() => ({}));
  if (res.status === 404 || !json?.data) {
    throw new Error(`Audius has no track ${trackId} — it may have been deleted.`);
  }
  if (!res.ok) throw new Error(`Could not read Audius track ${trackId} (${res.status})`);
  return json.data;
}

/**
 * Applies a metadata correction to a live Audius release.
 * `changes` may contain title, description, genre, mood, tags, isrc.
 * Returns { audiusTrackId, updated: [changed field names] }.
 */
export async function updateTrackOnAudius({
  apiKey,
  apiSecret,
  bearerToken,
  audiusUserId,
  audiusTrackId,
  changes = {},
}) {
  if (!apiKey) throw new Error('AUDIUS_API_KEY is not configured');
  if (!apiSecret && !bearerToken) throw new Error('AUDIUS_API_SECRET is not configured');
  if (!audiusUserId) throw new Error('No linked Audius account — connect Audius before editing a release');
  if (!audiusTrackId) throw new Error('audiusTrackId required');

  const live = await fetchLiveTrack({ apiKey, trackId: audiusTrackId });

  // Audius' own answer about who owns the release. Refusing here rather than
  // letting the write fail turns an opaque rejection into a statement the creator
  // can act on — and stops a stale stored id from aiming an edit at a stranger's track.
  const ownerId = live?.user?.id;
  if (ownerId && ownerId !== audiusUserId) {
    throw new Error(
      `That release belongs to a different Audius account (@${live?.user?.handle || 'unknown'}). ` +
      'Reconnect the account that owns it before editing.'
    );
  }

  // Live values first, corrections over the top. Only keys we actually hold are
  // applied, so an absent field leaves the live one standing.
  const liveTags = Array.isArray(live.tags) ? live.tags.join(',') : (live.tags || undefined);
  const merged = {
    title: live.title,
    description: live.description || '',
    genre: live.genre || undefined,
    mood: live.mood || undefined,
    tags: liveTags,
    isrc: live.isrc || undefined,
  };

  const updated = [];
  for (const key of ['title', 'description', 'genre', 'mood', 'isrc']) {
    const next = changes[key];
    if (next == null || next === '') continue;
    if (next === merged[key]) continue;
    merged[key] = next;
    updated.push(key);
  }
  if (Array.isArray(changes.tags) && changes.tags.length > 0) {
    const nextTags = [...new Set(changes.tags.filter(Boolean))].join(',');
    if (nextTags !== merged.tags) { merged.tags = nextTags; updated.push('tags'); }
  }

  // Nothing to say is not a failure — it means the live release already carries the
  // corrected values, which is the desired end state.
  if (updated.length === 0) {
    return { audiusTrackId, updated: [], unchanged: true };
  }

  const config = { apiKey, appName: 'BaseStation' };
  if (apiSecret) config.apiSecret = apiSecret;
  if (bearerToken) config.bearerToken = bearerToken;
  const audiusSdk = sdk(config);

  await audiusSdk.tracks.updateTrack({
    userId: audiusUserId,
    trackId: audiusTrackId,
    metadata: merged,
  });

  // Read the release back and check the correction actually landed. An accepted
  // write is not a completed one: the SDK resolving tells us Audius took the
  // request, not that the live record now says what we asked it to say.
  //
  // A negative result is reported, never thrown — Audius indexes a write through
  // its discovery nodes asynchronously, so a just-issued edit legitimately reads
  // back stale. Callers therefore treat `confirmed: false` as "not yet visible",
  // which is why this returns a third state instead of success/failure.
  let confirmed = false;
  try {
    const after = await fetchLiveTrack({ apiKey, trackId: audiusTrackId });
    confirmed = updated.every((key) => {
      if (key === 'tags') {
        const liveAfter = Array.isArray(after.tags) ? after.tags.join(',') : (after.tags || '');
        return liveAfter === merged.tags;
      }
      return (after[key] || '') === (merged[key] || '');
    });
  } catch {
    // Could not re-read; leave unconfirmed rather than assuming either outcome.
  }

  return { audiusTrackId, updated, unchanged: false, confirmed };
}