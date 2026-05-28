import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Build a curated radio playlist from approved community submissions.
 * (Audius trending is shown live in the Radio queue but not persisted here,
 * since Audius streams should be fetched fresh on play.)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { genre, mood, name, description } = await req.json();

    // Community submissions, top-liked first
    let communityTracks = [];
    try {
      const filter = genre ? { genre, status: 'approved' } : { status: 'approved' };
      const subs = await base44.asServiceRole.entities.TrackSubmission.filter(filter, '-like_count', 20);
      communityTracks = subs.map((s, i) => ({
        track_title: s.title,
        artist_name: s.artist_name || 'Community',
        cover_image_url: s.cover_image_url || '',
        audio_url: s.track_url || '',
        duration_seconds: s.duration_seconds || 0,
        genre: s.genre || genre || '',
        source: 'community',
        bpm: s.bpm || null,
        position: i,
      }));
    } catch (e) {
      console.warn('Community tracks (build):', e.message);
    }

    // Create Playlist entity
    const playlist = await base44.asServiceRole.entities.Playlist.create({
      title: name || `${genre ? genre.charAt(0).toUpperCase() + genre.slice(1) : 'Mixed'} Radio Mix`,
      description: description || `Auto-generated community playlist — ${[genre, mood].filter(Boolean).join(' / ')}`,
      genre: genre || 'all',
      is_featured: false,
      is_public: true,
      track_count: communityTracks.length,
      owner_name: 'Base Station Radio',
      tags: [genre, mood, 'radio', 'community', 'auto'].filter(Boolean),
    });

    // Persist tracks
    const created = await Promise.all(
      communityTracks.map(t =>
        base44.asServiceRole.entities.PlaylistTrack.create({
          playlist_id: playlist.id,
          track_title: t.track_title,
          artist_name: t.artist_name,
          cover_image_url: t.cover_image_url,
          audio_url: t.audio_url,
          duration_seconds: t.duration_seconds || 0,
          position: t.position,
          added_by: user.email,
          metadata: { source: t.source, bpm: t.bpm },
        }).catch(() => null)
      )
    );

    return Response.json({
      playlist_id: playlist.id,
      playlist,
      track_count: created.filter(Boolean).length,
      community_count: communityTracks.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});