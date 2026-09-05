import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { annotateTrack, annotateTracks } from '../../shared/audiusLicense.ts';
import { uploadTrackToAudius } from '../../shared/audiusUpload.ts';

/**
 * Unified Audius / OpenAudio Protocol client wrapper.
 *
 * Supported actions:
 *   publishTrack, publishMetadata, publishStems, publishBundle,
 *   getTrending, getArtist, getTrack, search,
 *   getFanGraph, getCreatorGraph
 *
 * Uses public Audius discovery nodes for read ops (no key needed).
 * Publish operations require AUDIUS_API_KEY + AUDIUS_PRIVATE_KEY.
 */

const MANAGED_GATEWAY = 'https://api.audius.co/v1';
const DEFAULT_DISCOVERY = 'https://discoveryprovider.audius.co';
const APP_NAME = 'BaseStation';

/**
 * Resolves the Audius base URL for READ operations.
 *
 * Audius carries the API key as an `api_key` QUERY PARAM on reads — it is not a
 * Bearer credential. `Authorization: Bearer …` is reserved for the separate
 * backend-only bearer token (app-level writes) and for per-user OAuth access
 * tokens; sending the API key there authenticates nothing and would silently
 * fail the moment a real write is attempted.
 *
 * Priority:
 *   1. AUDIUS_API_KEY set → managed gateway https://api.audius.co/v1 with ?api_key=
 *   2. Fallback to dynamic discovery node lookup with ?app_name=
 */
async function resolveAudiusBase() {
  const apiKey = Deno.env.get('AUDIUS_API_KEY');
  if (apiKey && apiKey.length > 8) {
    return {
      base: MANAGED_GATEWAY,
      headers: { 'Accept': 'application/json' },
      apiKey,
      useAppName: false,
    };
  }
  try {
    const r = await fetch('https://api.audius.co');
    const j = await r.json();
    const node = j?.data?.[0] || DEFAULT_DISCOVERY;
    return { base: `${node}/v1`, headers: { 'Accept': 'application/json' }, apiKey: null, useAppName: true };
  } catch {
    return { base: `${DEFAULT_DISCOVERY}/v1`, headers: { 'Accept': 'application/json' }, apiKey: null, useAppName: true };
  }
}

async function audiusGet(path, params = {}) {
  const { base, headers, apiKey, useAppName } = await resolveAudiusBase();
  const url = new URL(`${base}${path}`);
  if (apiKey) url.searchParams.set('api_key', apiKey);
  if (useAppName) url.searchParams.set('app_name', APP_NAME);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Audius ${path} ${res.status}: ${body.slice(0, 200)}`);
  }
  return await res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, payload = {} } = body;
    if (!action) return Response.json({ error: 'action required' }, { status: 400 });

    const apiKey = Deno.env.get('AUDIUS_API_KEY');

    switch (action) {
      // === READ-ONLY (public) ===
      case 'getTrending': {
        const data = await audiusGet('/tracks/trending', { genre: payload.genre, time: payload.time || 'week' });
        return Response.json({ data: annotateTracks(data?.data || []) });
      }
      case 'search': {
        const data = await audiusGet('/tracks/search', { query: payload.query, limit: payload.limit || 20 });
        return Response.json({ data: annotateTracks(data?.data || []) });
      }
      case 'getTrack': {
        if (!payload.trackId) throw new Error('trackId required');
        const data = await audiusGet(`/tracks/${payload.trackId}`);
        return Response.json({ data: annotateTrack(data?.data || null) });
      }
      case 'resolveHandle': {
        if (!payload.handle) throw new Error('handle required');
        const handle = String(payload.handle).replace(/^@/, '');
        const data = await audiusGet(`/users/handle/${encodeURIComponent(handle)}`);
        return Response.json({ data: data?.data || null });
      }
      case 'getArtist': {
        if (!payload.userId) throw new Error('userId required');
        const data = await audiusGet(`/users/${payload.userId}`);
        return Response.json({ data: data?.data || null });
      }
      case 'getFanGraph': {
        if (!payload.userId) throw new Error('userId required');
        const [followers, following] = await Promise.all([
          audiusGet(`/users/${payload.userId}/followers`).catch(() => ({ data: [] })),
          audiusGet(`/users/${payload.userId}/following`).catch(() => ({ data: [] })),
        ]);
        return Response.json({
          data: {
            followers: followers?.data || [],
            following: following?.data || [],
          }
        });
      }
      case 'getCreatorGraph': {
        if (!payload.userId) throw new Error('userId required');
        const [tracks, profile] = await Promise.all([
          audiusGet(`/users/${payload.userId}/tracks`).catch(() => ({ data: [] })),
          audiusGet(`/users/${payload.userId}`).catch(() => ({ data: null })),
        ]);
        return Response.json({
          data: { profile: profile?.data, tracks: annotateTracks(tracks?.data || []) }
        });
      }

      // === WRITE ===
      // A real upload needs the app's api key + api secret (or, when a creator has
      // authorized the app individually, their OAuth bearer token) AND the
      // creator's Audius user id. Missing any of them reports SIMULATED rather
      // than 'pending' — callers persist what they are told, and a
      // plausible-looking id renders in the app as a real release.
      case 'publishTrack': {
        const apiSecret = Deno.env.get('AUDIUS_API_SECRET');
        // A per-user OAuth bearer token can be passed in by a caller that has one;
        // the app itself writes with apiKey + apiSecret.
        const bearerToken = payload.bearer_token || undefined;
        const audiusUserId = payload.audius_user_id;
        if (!apiKey || !(apiSecret || bearerToken) || !audiusUserId) {
          return Response.json({
            simulated: true,
            data: {
              audius_track_id: `sim_${Date.now()}`,
              status: 'simulated',
              note: !audiusUserId
                ? 'No linked Audius account — connect Audius in Distribution before publishing.'
                : 'Audius credentials are incomplete (API key + API secret required).',
            }
          }, { status: 200 });
        }
        const uploaded = await uploadTrackToAudius({
          apiKey,
          apiSecret,
          bearerToken,
          audiusUserId,
          audioUrl: payload.file_url,
          coverUrl: payload.cover_url,
          metadata: {
            title: payload.title,
            description: payload.description,
            genre: payload.genre,
            mood: payload.mood,
            tags: payload.tags,
            isrc: payload.isrc,
            // Audius flags an AI release by attributing it to the account it was
            // made under, so this is only set when our own disclosure says the
            // recording is AI-generated.
            aiAttributionUserId:
              payload.ai_disclosure_label === 'ai_generated' ? audiusUserId : undefined,
          },
        });
        return Response.json({
          data: { audius_track_id: uploaded.audiusTrackId, status: 'success' }
        });
      }

      // Not implemented. These are NOT single-track uploads — a bundle, a stem set
      // and a metadata-only edit each need their own Audius shape. They return an
      // explicit failure rather than a `sim_` id: handing back a plausible id let
      // callers persist a release that never happened.
      case 'publishMetadata':
      case 'publishStems':
      case 'publishBundle': {
        return Response.json({
          error: `'${action}' is not supported yet — only single-track publishing is wired to Audius.`,
        }, { status: 501 });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});