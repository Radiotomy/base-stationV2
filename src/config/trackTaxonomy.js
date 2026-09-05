// Canonical genre + mood vocabulary for every generation studio.
//
// These lists are DELIBERATELY identical to the closed vocabularies Audius
// accepts (see base44/shared/audiusMetadata.ts). Picking from them means a track
// leaves the studio already carrying a distributable value, so the publish-time
// normalizer has nothing to guess at and the "everything becomes Electronic"
// fallback can never fire for a track a creator actually labelled.
//
// A studio's own conditioning channel (tags / style prompt / caption) is separate
// from these: this is release metadata, not a render parameter.

export const TRACK_GENRES = [
  'Electronic', 'Rock', 'Metal', 'Alternative', 'Hip-Hop/Rap', 'Experimental',
  'Punk', 'Folk', 'Pop', 'Ambient', 'Soundtrack', 'World', 'Jazz', 'Acoustic',
  'Funk', 'R&B/Soul', 'Devotional', 'Classical', 'Reggae', 'Country',
  'Spoken Word', 'Comedy', 'Blues', 'Kids', 'Latin', 'Lo-Fi', 'Hyperpop',
  'Dancehall', 'Techno', 'Trap', 'House', 'Tech House', 'Deep House', 'Disco',
  'Electro', 'Jungle', 'Progressive House', 'Hardstyle', 'Glitch Hop', 'Trance',
  'Future Bass', 'Future House', 'Tropical House', 'Downtempo', 'Drum & Bass',
  'Dubstep', 'Jersey Club', 'Vaporwave', 'Moombahton',
];

export const TRACK_MOODS = [
  'Peaceful', 'Romantic', 'Sentimental', 'Tender', 'Easygoing', 'Yearning',
  'Sophisticated', 'Sensual', 'Cool', 'Gritty', 'Melancholy', 'Serious',
  'Brooding', 'Fiery', 'Defiant', 'Aggressive', 'Rowdy', 'Excited',
  'Energizing', 'Empowering', 'Stirring', 'Upbeat', 'Other',
];