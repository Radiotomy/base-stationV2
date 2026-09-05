/**
 * Real Audius track upload (Phase B).
 *
 * Audius has no plain REST upload endpoint — an upload must be signed and handed
 * to a content node, which only the official SDK does. This is the single place
 * the SDK is constructed, so every publish path imports it rather than
 * re-deriving credential handling.
 *
 * Audius issues THREE distinct credentials and they are not interchangeable:
 *   - apiKey    — public app identifier, also used as ?api_key= on reads
 *   - apiSecret — the app's own write credential (backend only). This is what
 *                 authorizes writes performed by the app itself.
 *   - bearer    — a per-user OAuth token, issued only when an individual creator
 *                 authorizes the app. Optional here: when present it scopes the
 *                 write to that user instead of the app.
 * Passing the wrong one silently produces an unauthorized write, so each is
 * named explicitly rather than collapsed into one "secret" argument.
 */

// v16's exports map forces the BROWSER bundle in this runtime, which imports
// crypto-browserify (an Audius dev-dependency) and cannot be resolved. v9 has no
// exports map, so the Node CJS build can be requested by path directly.
import * as audiusSdkPkg from 'npm:@audius/sdk@9.1.0/dist/index.cjs.js';
// CJS interop: the named export may sit on the namespace or under `default`.
const sdk = audiusSdkPkg.sdk || audiusSdkPkg.default?.sdk;

/** Downloads a URL into the { buffer, name } shape the SDK's file params expect. */
async function fetchAsFile(url, fallbackName) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not read source file (${res.status}) — ${url.slice(0, 120)}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  // Name matters: the content node infers the container from the extension, so a
  // name without one is rejected as an unsupported file rather than transcoded.
  const fromUrl = (url.split('?')[0].split('/').pop() || '').trim();
  const name = /\.[a-z0-9]{2,4}$/i.test(fromUrl) ? fromUrl : fallbackName;
  return { buffer: bytes, name };
}

/**
 * Uploads a track to Audius as `audiusUserId`.
 * Returns { audiusTrackId, status: 'success' }.
 */
export async function uploadTrackToAudius({
  apiKey,
  apiSecret,
  bearerToken,
  audiusUserId,
  audioUrl,
  coverUrl,
  metadata = {},
}) {
  if (!apiKey) throw new Error('AUDIUS_API_KEY is not configured');
  if (!apiSecret && !bearerToken) throw new Error('AUDIUS_API_SECRET is not configured');
  if (!audiusUserId) throw new Error('No linked Audius account — connect Audius before publishing');
  if (!audioUrl) throw new Error('audioUrl required');

  const config = { apiKey, appName: 'BaseStation' };
  if (apiSecret) config.apiSecret = apiSecret;
  if (bearerToken) config.bearerToken = bearerToken;
  const audiusSdk = sdk(config);

  const trackFile = await fetchAsFile(audioUrl, 'track.mp3');
  const coverArtFile = coverUrl
    ? await fetchAsFile(coverUrl, 'cover.jpg').catch(() => null)
    : null;

  const uploadArgs = {
    userId: audiusUserId,
    trackFile,
    metadata: {
      title: metadata.title,
      description: metadata.description || '',
      genre: metadata.genre || 'Electronic',
      mood: metadata.mood || undefined,
      tags: Array.isArray(metadata.tags) ? metadata.tags.join(',') : undefined,
      isUnlisted: metadata.isUnlisted === true,
    },
  };
  if (coverArtFile) uploadArgs.coverArtFile = coverArtFile;

  const result = await audiusSdk.tracks.uploadTrack(uploadArgs);
  const audiusTrackId = result?.trackId || result?.data?.id || result?.id;
  if (!audiusTrackId) {
    // Never invent an id: a fabricated one renders in the app as a real release.
    throw new Error('Audius accepted the upload but returned no track id');
  }
  return { audiusTrackId, status: 'success' };
}