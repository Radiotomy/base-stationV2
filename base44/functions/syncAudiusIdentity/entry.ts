import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Sync Audius identity for the current user.
 * Payload: { audiusUserId } — the user's Audius user ID
 *
 * Stores: User.metadata.audius and ArtistProfile.metadata.audius
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { audiusUserId } = await req.json();
    if (!audiusUserId) return Response.json({ error: 'audiusUserId required' }, { status: 400 });

    // Fetch creator + fan graph
    const [creator, fans] = await Promise.all([
      base44.asServiceRole.functions.invoke('audiusClient', {
        action: 'getCreatorGraph', payload: { userId: audiusUserId },
      }),
      base44.asServiceRole.functions.invoke('audiusClient', {
        action: 'getFanGraph', payload: { userId: audiusUserId },
      }),
    ]);

    const profile = creator?.data?.profile || {};
    const tracks = creator?.data?.tracks || [];
    const followers = fans?.data?.followers || [];
    const following = fans?.data?.following || [];

    // Phase 5: optional Audius collectibles + badges fetch (non-blocking)
    let audiusCollectibles = [];
    let audiusBadges = [];
    try {
      const collectibleRes = await base44.asServiceRole.functions.invoke('audiusClient', {
        action: 'getUserCollectibles', payload: { userId: audiusUserId },
      });
      audiusCollectibles = collectibleRes?.data?.collectibles || [];
      audiusBadges = collectibleRes?.data?.badges || [];
    } catch { /* gracefully degrade */ }

    const audiusData = {
      audius_user_id: audiusUserId,
      handle: profile.handle,
      name: profile.name,
      profile_picture: profile.profile_picture?.['480x480'] || profile.profile_picture?.['150x150'],
      bio: profile.bio,
      follower_count: profile.follower_count ?? followers.length,
      following_count: profile.following_count ?? following.length,
      track_count: tracks.length,
      verified: profile.is_verified || false,
      collectibles: audiusCollectibles,
      badges: audiusBadges,
      synced_at: new Date().toISOString(),
    };

    // Update User
    await base44.auth.updateMe({
      metadata: {
        ...(user.metadata || {}),
        audius: audiusData,
      },
    });

    // Update ArtistProfile if exists
    const profiles = await base44.asServiceRole.entities.ArtistProfile.filter({ user_id: user.id });
    if (profiles[0]) {
      await base44.asServiceRole.entities.ArtistProfile.update(profiles[0].id, {
        metadata: {
          ...(profiles[0].metadata || {}),
          audius: audiusData,
        },
      });
    }

    return Response.json({ data: audiusData });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});