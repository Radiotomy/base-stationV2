import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const APP_NAME = 'BaseStation';
const DEFAULT_NODE = 'https://discoveryprovider.audius.co';

async function getNode() {
  const override = Deno.env.get('AUDIUS_NODE_URL');
  if (override) return override;
  try {
    const r = await fetch('https://api.audius.co');
    const j = await r.json();
    return j?.data?.[0] || DEFAULT_NODE;
  } catch {
    return DEFAULT_NODE;
  }
}

async function fetchTrack(node, trackId) {
  const url = new URL(`${node}/v1/tracks/${trackId}`);
  url.searchParams.set('app_name', APP_NAME);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data || null;
}

/**
 * Import an Audius track (and any provided stems) into the user's library
 * with FULL metadata: cover artwork, artist, genre, mood, BPM, duration, tags, etc.
 *
 * Payload: { trackId, stems?: [{ url, name }] }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { trackId, stems = [] } = await req.json();
    if (!trackId) return Response.json({ error: 'trackId required' }, { status: 400 });

    // Direct fetch from Audius discovery node (no auth, no wrappers)
    const node = await getNode();
    const track = await fetchTrack(node, trackId);
    if (!track) return Response.json({ error: 'Audius track not found' }, { status: 404 });

    const artistName = track.user?.name || track.user?.handle || 'Unknown Artist';
    const artwork = track.artwork?.['1000x1000']
                 || track.artwork?.['480x480']
                 || track.artwork?.['150x150']
                 || null;
    const streamUrl = `${node}/v1/tracks/${trackId}/stream?app_name=${APP_NAME}`;

    // Build a rich metadata object that the studio TrackCard already understands
    const baseMetadata = {
      // Audius identity
      audius_track_id: trackId,
      audius_permalink: track.permalink,
      audius_artist: artistName,
      audius_handle: track.user?.handle,
      audius_artist_id: track.user?.id,
      audius_verified: track.user?.is_verified || false,
      audius_play_count: track.play_count,
      audius_favorite_count: track.favorite_count,
      audius_repost_count: track.repost_count,

      // Track metadata (mapped to TrackCard fields)
      artist: artistName,
      genre: track.genre || null,
      mood: track.mood || null,
      duration: track.duration || null,
      release_date: track.release_date || null,
      tags_text: track.tags || null,
      isrc: track.isrc || null,
      iswc: track.iswc || null,
      license: track.license || null,
      provider: 'audius',
      ai_assisted: false,
    };

    // If no explicit stems provided, treat the master track as the imported asset
    const items = stems.length > 0
      ? stems.map(s => ({ url: s.url, name: s.name || track.title, isStem: true }))
      : [{ url: streamUrl, name: track.title, isStem: false }];

    const created = [];
    for (const it of items) {
      const asset = await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'track',
        title: it.name,
        description: `${track.title} — ${artistName}${track.description ? `\n\n${track.description}` : ''}`,
        file_url: it.url,
        thumbnail_url: artwork,
        origin: 'audius',
        is_public: false,
        tags: [
          'audius',
          'imported',
          ...(track.genre ? [track.genre.toLowerCase()] : []),
          ...(track.mood ? [track.mood.toLowerCase()] : []),
          ...(it.isStem ? ['stem'] : []),
        ],
        metadata: {
          ...baseMetadata,
          stem_name: it.isStem ? it.name : undefined,
        },
      });
      created.push(asset);
    }

    return Response.json({
      data: {
        imported: created.length,
        assets: created,
        track: {
          title: track.title,
          artist: artistName,
          artwork,
        }
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});