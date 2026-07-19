import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { annotateTrack, annotateTracks } from '../../shared/audiusLicense.ts';

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
 * Resolves the Audius base URL + auth header.
 * Priority:
 *   1. AUDIUS_API_KEY set → use managed gateway https://api.audius.co/v1 with Bearer auth (docs.audius.co/api/)
 *   2. AUDIUS_NODE_URL override → use it with app_name
 *   3. Fallback to dynamic discovery node lookup
 */
async function resolveAudiusBase() {
  const apiKey = Deno.env.get('AUDIUS_API_KEY');
  if (apiKey && apiKey.length > 8) {
    return {
      base: MANAGED_GATEWAY,
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
      useAppName: false,
    };
  }
  try {
    const r = await fetch('https://api.audius.co');
    const j = await r.json();
    const node = j?.data?.[0] || DEFAULT_DISCOVERY;
    return { base: `${node}/v1`, headers: { 'Accept': 'application/json' }, useAppName: true };
  } catch {
    return { base: `${DEFAULT_DISCOVERY}/v1`, headers: { 'Accept': 'application/json' }, useAppName: true };
  }
}

async function audiusGet(path, params = {}) {
  const { base, headers, useAppName } = await resolveAudiusBase();
  const url = new URL(`${base}${path}`);
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

      // === WRITE (requires key) ===
      case 'publishTrack':
      case 'publishMetadata':
      case 'publishStems':
      case 'publishBundle': {
        if (!apiKey) {
          return Response.json({
            simulated: true,
            data: {
              audius_track_id: `sim_${Date.now()}`,
              status: 'simulated',
              note: 'Set AUDIUS_API_KEY to enable real Audius publishing',
            }
          }, { status: 200 });
        }
        // Real publishing implementation goes here once keys are available.
        // For now, return a structured success that callers can persist.
        return Response.json({
          data: {
            audius_track_id: `pending_${Date.now()}`,
            status: 'pending',
            note: 'Real Audius publish not yet wired — keys present',
          }
        });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});