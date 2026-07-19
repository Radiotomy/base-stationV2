// Shared Audius licensing compliance logic.
// A track is only "open" for sampling / stems / import when it carries an
// active Creative Commons license OR the artist explicitly flagged it for
// open remixing (downloads enabled). The Audius default — 'All Rights
// Reserved' or an empty license field — is treated as fully restricted.

const CC_PATTERN = /(creative\s*commons|\bcc[\s-]?(by|0|zero)\b|attribution|public\s*domain|sampling\+?)/i;

export function getLicenseStatus(track) {
  const license = (track?.license || '').trim();
  const isCC = CC_PATTERN.test(license);
  const openRemix =
    track?.is_downloadable === true ||
    track?.download?.is_downloadable === true;
  const is_open = isCC || openRemix;
  return {
    license: license || 'All Rights Reserved',
    is_open,
    is_cc: isCC,
    open_remix: openRemix,
    reason: is_open
      ? (isCC ? 'Creative Commons license' : 'Artist enabled downloads / open remixing')
      : 'All Rights Reserved — importing, sampling and stem extraction are not permitted',
  };
}

export function annotateTrack(track) {
  if (!track) return track;
  return { ...track, licensing: getLicenseStatus(track) };
}

export function annotateTracks(tracks) {
  return (tracks || []).map(annotateTrack);
}