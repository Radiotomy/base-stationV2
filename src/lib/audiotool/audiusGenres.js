// Audius' closed genre vocabulary (mirrors the server-side list the release is
// validated against), plus a best guess from Audiotool project tags.
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

const ALIASES = {
  'hip hop': 'Hip-Hop/Rap', 'hiphop': 'Hip-Hop/Rap', 'hip-hop': 'Hip-Hop/Rap', rap: 'Hip-Hop/Rap',
  lofi: 'Lo-Fi', 'lo fi': 'Lo-Fi', rnb: 'R&B/Soul', 'r&b': 'R&B/Soul', soul: 'R&B/Soul',
  edm: 'Electronic', dance: 'Electronic', synthwave: 'Electronic', dnb: 'Drum & Bass',
  'drum and bass': 'Drum & Bass', chill: 'Downtempo', indie: 'Alternative', acid: 'Techno',
};

/** First project tag that maps onto an Audius genre, or '' when none do. */
export function guessGenre(tags = []) {
  for (const raw of tags) {
    const t = String(raw).trim().toLowerCase();
    const exact = AUDIUS_GENRES.find((g) => g.toLowerCase() === t);
    if (exact) return exact;
    if (ALIASES[t]) return ALIASES[t];
  }
  return '';
}