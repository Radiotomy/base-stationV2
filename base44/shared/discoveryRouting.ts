// BASE Station ecosystem routing — once an Audiotool Bridge export is
// watermarked, C2PA-sealed and anchored (its BaseTrackRegistry row is
// 'registered'), it is published into the platform's own discovery surfaces:
//   • Charts (TrackChart rows for every period, so it appears on /charts and
//     is eligible for the homepage Top Tracks as votes come in)
//   • the featured "Fresh from the Audiotool Bridge" community playlist
// Radio reads protected registry rows directly (radioQueue), so nothing is
// duplicated for it here.
//
// Called only by sealProtectedExport after a successful anchor. Runs once per
// asset — guarded by metadata.discovery_routing.

const CHART_GENRES = ['hip-hop', 'edm', 'pop', 'r&b', 'rock', 'lo-fi', 'jazz', 'classical', 'trap', 'other'];
// Audius genre names (what Bridge exports store) → our chart genres.
const AUDIUS_TO_CHART = {
  'hip-hop/rap': 'hip-hop', 'r&b/soul': 'r&b', electronic: 'edm', house: 'edm', techno: 'edm',
  'tech house': 'edm', 'deep house': 'edm', dubstep: 'edm', trance: 'edm', 'drum & bass': 'edm',
  'future bass': 'edm', 'progressive house': 'edm', hardstyle: 'edm', electro: 'edm',
  metal: 'rock', alternative: 'rock', punk: 'rock',
};
const CHART_LABELS = ['ai_generated', 'ai_assisted', 'human'];
const PERIODS = ['weekly', 'monthly', 'all-time'];
export const BRIDGE_PLAYLIST_TITLE = 'Fresh from the Audiotool Bridge';
const PLAYLIST_OWNER = 'BASE Station';

export async function routeAnchoredExport(svc, asset, { registry_id, transaction_hash }) {
  if (asset.metadata?.discovery_routing?.routed_at) return { skipped: true, reason: 'Already routed' };
  const reg = await svc.entities.BaseTrackRegistry.get(registry_id).catch(() => null);
  if (!reg || reg.registration_status !== 'registered' || !reg.track_url) {
    return { skipped: true, reason: 'Registry record not registered' };
  }

  const g = String(asset.metadata?.genre || '').toLowerCase();
  const genre = CHART_GENRES.includes(g) ? g : (AUDIUS_TO_CHART[g] || 'other');
  const label = CHART_LABELS.includes(asset.ai_label) ? asset.ai_label : undefined;
  const profile = (await svc.entities.ArtistProfile.filter({ user_id: asset.user_id }, '-created_date', 1).catch(() => []))[0];
  const verify = `Protected on BASE Station · anchored on Base: https://basescan.org/tx/${transaction_hash}`;
  const common = {
    track_title: reg.track_title,
    artist_name: profile?.display_name || reg.artist_name || 'BASE Station Artist',
    artist_id: asset.user_id,
    artist_slug: profile?.slug || undefined,
    cover_image_url: asset.thumbnail_url || reg.cover_image_url || '',
    audio_url: reg.track_url,
    genre,
    ai_label: label,
  };

  await svc.entities.TrackChart.bulkCreate(PERIODS.map((period) => ({
    ...common,
    period,
    total_votes: 0, total_plays: 0, weekly_votes: 0, monthly_votes: 0,
    tags: ['audiotool-bridge', 'c2pa-sealed', 'base-anchored'],
    description: verify,
  })));

  let playlist = (await svc.entities.Playlist.filter({ title: BRIDGE_PLAYLIST_TITLE, owner_name: PLAYLIST_OWNER }, '-created_date', 1))[0];
  if (!playlist) {
    playlist = await svc.entities.Playlist.create({
      title: BRIDGE_PLAYLIST_TITLE,
      description: 'Every track made in Audiotool, watermarked with BASE Mark, C2PA-sealed and anchored on Base.',
      owner_name: PLAYLIST_OWNER,
      is_featured: true,
      is_public: true,
      genre: 'all',
      track_count: 0,
      tags: ['audiotool-bridge', 'protected'],
    });
  }
  const existing = await svc.entities.PlaylistTrack.filter({ playlist_id: playlist.id }, '-position', 500);
  await svc.entities.PlaylistTrack.create({
    playlist_id: playlist.id,
    track_title: common.track_title,
    artist_name: common.artist_name,
    artist_id: common.artist_id,
    audio_url: common.audio_url,
    cover_image_url: common.cover_image_url,
    genre,
    position: existing.length,
    source_type: 'upload',
    source_id: asset.id,
    description: verify,
  });
  await svc.entities.Playlist.update(playlist.id, {
    track_count: existing.length + 1,
    ...(common.cover_image_url ? { cover_image_url: common.cover_image_url } : {}),
  });

  const latest = await svc.entities.UserAsset.get(asset.id);
  await svc.entities.UserAsset.update(asset.id, {
    metadata: {
      ...latest.metadata,
      discovery_routing: { routed_at: new Date().toISOString(), registry_id, playlist_id: playlist.id },
    },
  });
  return { routed: true, playlist_id: playlist.id };
}