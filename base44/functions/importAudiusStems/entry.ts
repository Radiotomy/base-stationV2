import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Import stems from an Audius track into the user's UserAsset library.
 * Tags imported assets with origin = "audius".
 *
 * Payload: { trackId, stems: [{ url, name }] }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { trackId, stems = [] } = await req.json();
    if (!trackId) return Response.json({ error: 'trackId required' }, { status: 400 });

    // Fetch source track for metadata
    const trackRes = await base44.asServiceRole.functions.invoke('audiusClient', {
      action: 'getTrack', payload: { trackId },
    });
    const track = trackRes?.data;
    if (!track) return Response.json({ error: 'Audius track not found' }, { status: 404 });

    // If no explicit stems, treat the track itself as the imported stem
    const stemList = stems.length > 0 ? stems : [{
      url: track.stream_url || `https://discoveryprovider.audius.co/v1/tracks/${trackId}/stream?app_name=BaseStation`,
      name: track.title || 'Audius Track',
    }];

    const created = [];
    for (const s of stemList) {
      const asset = await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'track',
        title: s.name || track.title,
        description: `Imported from Audius — ${track.user?.name || 'Unknown artist'}`,
        file_url: s.url,
        thumbnail_url: track.artwork?.['480x480'] || track.artwork?.['150x150'],
        origin: 'audius',
        tags: ['audius', 'imported', ...(track.genre ? [track.genre.toLowerCase()] : [])],
        metadata: {
          audius_track_id: trackId,
          audius_artist: track.user?.name,
          audius_handle: track.user?.handle,
          genre: track.genre,
          mood: track.mood,
          duration: track.duration,
        },
      });
      created.push(asset);
    }

    return Response.json({ data: { imported: created.length, assets: created } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});