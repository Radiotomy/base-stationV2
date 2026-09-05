/**
 * Audius publish pre-flight: genre normalization, artwork resolution and source
 * reachability.
 *
 * Audius validates these at the content node, AFTER a multi-megabyte upload has
 * already been streamed. Checking them here turns three late, opaque rejections
 * into three specific answers a creator can act on before anything is sent.
 */

/**
 * Audius' genre vocabulary. This is a CLOSED list on their side — a value outside
 * it is rejected outright rather than stored as a custom tag, which is why free-text
 * genre metadata ("neo-soul", "lofi hiphop") cannot be forwarded as-is.
 */
export const AUDIUS_GENRES = [
  'Electronic', 'Rock', 'Metal', 'Alternative', 'Hip-Hop/Rap', 'Experimental',
  'Punk', 'Folk', 'Pop', 'Ambient', 'Soundtrack', 'World', 'Jazz', 'Acoustic',
  'Funk', 'R&B/Soul', 'Devotional', 'Classical', 'Reggae', 'Country',
  'Spoken Word', 'Comedy', 'Blues', 'Kids', 'Latin', 'Lo-Fi', 'Hyperpop',
  'Dancehall', 'Techno', 'Trap', 'House', 'Tech House', 'Deep House', 'Disco',
  'Electro', 'Jungle', 'Progressive House', 'Hardstyle', 'Glitch Hop', 'Trance',
  'Future Bass', 'Future House', 'Tropical House', 'Downtempo', 'Drum & Bass',
  'Dubstep', 'Jersey Club', 'Vaporwave', 'Moombahton',
];

/**
 * How the genres our studios actually emit map onto that list. Only entries whose
 * target genuinely differs from a normalized exact match are listed — this is a
 * translation table, not a copy of AUDIUS_GENRES.
 */
const GENRE_ALIASES = {
  'hip hop': 'Hip-Hop/Rap',
  'hiphop': 'Hip-Hop/Rap',
  'hip-hop': 'Hip-Hop/Rap',
  'rap': 'Hip-Hop/Rap',
  'boom bap': 'Hip-Hop/Rap',
  'drill': 'Hip-Hop/Rap',
  'lofi': 'Lo-Fi',
  'lo fi': 'Lo-Fi',
  'lofi hip hop': 'Lo-Fi',
  'lofi hiphop': 'Lo-Fi',
  'chillhop': 'Lo-Fi',
  'rnb': 'R&B/Soul',
  'r&b': 'R&B/Soul',
  'rhythm and blues': 'R&B/Soul',
  'soul': 'R&B/Soul',
  'neo soul': 'R&B/Soul',
  'neo-soul': 'R&B/Soul',
  'motown': 'R&B/Soul',
  'gospel': 'Devotional',
  'worship': 'Devotional',
  'christian': 'Devotional',
  'edm': 'Electronic',
  'dance': 'Electronic',
  'synthwave': 'Electronic',
  'synth pop': 'Pop',
  'synthpop': 'Pop',
  'indie': 'Alternative',
  'indie rock': 'Alternative',
  'indie pop': 'Pop',
  'grunge': 'Rock',
  'hard rock': 'Rock',
  'classic rock': 'Rock',
  'heavy metal': 'Metal',
  'dnb': 'Drum & Bass',
  'drum and bass': 'Drum & Bass',
  'drum n bass': 'Drum & Bass',
  'liquid dnb': 'Drum & Bass',
  'orchestral': 'Classical',
  'cinematic': 'Soundtrack',
  'score': 'Soundtrack',
  'film score': 'Soundtrack',
  'trailer': 'Soundtrack',
  'chill': 'Downtempo',
  'chillout': 'Downtempo',
  'trip hop': 'Downtempo',
  'afrobeat': 'World',
  'afrobeats': 'World',
  'afro house': 'House',
  'reggaeton': 'Latin',
  'salsa': 'Latin',
  'cumbia': 'Latin',
  'bossa nova': 'Latin',
  'k-pop': 'Pop',
  'kpop': 'Pop',
  'singer songwriter': 'Folk',
  'americana': 'Folk',
  'bluegrass': 'Country',
  'ska': 'Reggae',
  'dub': 'Reggae',
  'meditation': 'Ambient',
  'binaural': 'Ambient',
  'drone': 'Ambient',
  'noise': 'Experimental',
  'idm': 'Experimental',
  'breakbeat': 'Electro',
  'garage': 'House',
  'uk garage': 'House',
  'minimal': 'Techno',
  'acid': 'Techno',
  'psytrance': 'Trance',
  'hardcore': 'Hardstyle',
  'phonk': 'Trap',
  'podcast': 'Spoken Word',
  'audiobook': 'Spoken Word',
  'narration': 'Spoken Word',
  'voiceover': 'Spoken Word',
  'sound effects': 'Experimental',
  'sfx': 'Experimental',
};

/**
 * Best Audius genre for a free-text value, or the fallback when nothing matches.
 *
 * Falls back rather than throwing: an unrecognized genre is a metadata detail, and
 * refusing to publish a finished track over it would be a worse outcome than filing
 * it under a sane default.
 */
export function normalizeAudiusGenre(raw, fallback = 'Electronic') {
  if (!raw || typeof raw !== 'string') return fallback;
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!cleaned) return fallback;

  const exact = AUDIUS_GENRES.find((g) => g.toLowerCase() === cleaned);
  if (exact) return exact;

  if (GENRE_ALIASES[cleaned]) return GENRE_ALIASES[cleaned];

  // Multi-genre strings ("lofi hip hop, jazzy") are common in prompt metadata —
  // take the first segment that resolves rather than rejecting the whole value.
  for (const part of cleaned.split(/[,/|>&]+|\band\b/)) {
    const p = part.trim();
    if (!p) continue;
    const partExact = AUDIUS_GENRES.find((g) => g.toLowerCase() === p);
    if (partExact) return partExact;
    if (GENRE_ALIASES[p]) return GENRE_ALIASES[p];
  }

  // Last resort: a contained alias key ("dark trap beat" → Trap).
  const hit = Object.keys(GENRE_ALIASES)
    .sort((a, b) => b.length - a.length)
    .find((k) => cleaned.includes(k));
  return hit ? GENRE_ALIASES[hit] : fallback;
}

// Audius' mood field is a CLOSED vocabulary, exactly like genre — a free-text mood
// from our studios ("Energetic", "Chill") is rejected by the track write with a bare
// 400, after the audio has already been uploaded.
const AUDIUS_MOODS = [
  'Peaceful', 'Romantic', 'Sentimental', 'Tender', 'Easygoing', 'Yearning',
  'Sophisticated', 'Sensual', 'Cool', 'Gritty', 'Melancholy', 'Serious',
  'Brooding', 'Fiery', 'Defiant', 'Aggressive', 'Rowdy', 'Excited',
  'Energizing', 'Empowering', 'Stirring', 'Upbeat', 'Other',
];

const MOOD_ALIASES = {
  'energetic': 'Energizing', 'energy': 'Energizing', 'hype': 'Excited',
  'hyped': 'Excited', 'happy': 'Upbeat', 'joyful': 'Upbeat', 'fun': 'Upbeat',
  'playful': 'Easygoing', 'chill': 'Easygoing', 'chilled': 'Easygoing',
  'relaxed': 'Peaceful', 'calm': 'Peaceful', 'ambient': 'Peaceful',
  'dreamy': 'Yearning', 'nostalgic': 'Sentimental', 'emotional': 'Sentimental',
  'sad': 'Melancholy', 'somber': 'Melancholy', 'dark': 'Brooding',
  'moody': 'Brooding', 'intense': 'Fiery', 'angry': 'Aggressive',
  'hard': 'Aggressive', 'confident': 'Empowering', 'triumphant': 'Empowering',
  'epic': 'Stirring', 'cinematic': 'Stirring', 'smooth': 'Cool',
  'sexy': 'Sensual', 'raw': 'Gritty', 'party': 'Rowdy', 'love': 'Romantic',
};

/**
 * Best Audius mood for a free-text value, or undefined when nothing matches.
 *
 * Returns undefined rather than a default: mood is optional on a release, so an
 * unmappable value is better omitted than guessed — a wrong mood is a false claim
 * about the record, while a missing one costs nothing.
 */
export function normalizeAudiusMood(raw) {
  if (!raw || typeof raw !== 'string') return undefined;
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!cleaned) return undefined;

  const exact = AUDIUS_MOODS.find((m) => m.toLowerCase() === cleaned);
  if (exact) return exact;
  if (MOOD_ALIASES[cleaned]) return MOOD_ALIASES[cleaned];

  for (const part of cleaned.split(/[,/|>&]+|\band\b/)) {
    const p = part.trim();
    if (!p) continue;
    const partExact = AUDIUS_MOODS.find((m) => m.toLowerCase() === p);
    if (partExact) return partExact;
    if (MOOD_ALIASES[p]) return MOOD_ALIASES[p];
  }
  return undefined;
}

/**
 * Finds artwork for a track. Audius REQUIRES cover art on upload, so a track with
 * none cannot be published at all.
 *
 * Order: an explicitly chosen cover, then the asset's own thumbnail, then a cover-art
 * asset the creator already generated for this track.
 */
export async function resolveCoverArtUrl(base44, asset, explicitCoverArtId) {
  if (explicitCoverArtId) {
    const [chosen] = await base44.entities.UserAsset.filter({ id: explicitCoverArtId });
    if (chosen?.file_url) return { url: chosen.file_url, source: 'selected' };
  }

  if (asset.thumbnail_url) return { url: asset.thumbnail_url, source: 'thumbnail' };

  // Cover Art Studio files its output as a separate asset pointing back at the
  // track, so the artwork frequently exists without ever being copied onto the
  // track row itself.
  const linked = await base44.entities.UserAsset.filter({
    asset_type: 'coverart',
    related_track_id: asset.id,
  });
  const withFile = linked.find((c) => c.file_url);
  if (withFile) return { url: withFile.file_url, source: 'linked' };

  return { url: null, source: 'none' };
}

/**
 * Confirms the audio can actually be read server-side before an upload is attempted.
 * The upload downloads this URL from our backend, so a private, expired or signed
 * URL fails there — long after the creator has been told publishing started.
 */
export async function assertSourceReadable(url) {
  let res;
  try {
    res = await fetch(url, { method: 'HEAD' });
  } catch (e) {
    throw new Error(`This track's audio file could not be reached for upload (${e.message}). Re-save it to your library and try again.`);
  }
  // Some stores reject HEAD but serve GET — a ranged GET distinguishes "no HEAD
  // support" from a genuinely unreachable file.
  if (res.status === 405 || res.status === 501) {
    res = await fetch(url, { headers: { Range: 'bytes=0-1' } });
  }
  if (!res.ok && res.status !== 206) {
    throw new Error(`This track's audio file is not publicly readable (HTTP ${res.status}), so Audius cannot fetch it. Re-save it to your library and try again.`);
  }
}