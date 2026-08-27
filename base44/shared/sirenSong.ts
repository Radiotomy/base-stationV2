// Siren Song (HeartMuLa) version resolution.
//
// The model is rebuilt by a GitHub Actions pipeline on every push to the model
// repo's `main` branch, and each build gets a NEW Replicate version id. Pinning
// that id in a secret meant a manual secret update after every merge — so the
// backend now asks Replicate for the model's latest published version at call
// time instead. SIREN_SONG_VERSION remains only as a fallback for when the
// models endpoint is unreachable; it no longer needs to be kept current.
//
// Every backend function that calls Siren Song must get its version from
// resolveSirenSongVersion() — never from the secret directly.

import { secrets } from 'base44:runtime';

export async function resolveSirenSongVersion() {
  const token = secrets.get('REPLICATE_API_TOKEN');
  const model = secrets.get('SIREN_SONG_MODEL'); // "owner/name"

  try {
    const res = await fetch(`https://api.replicate.com/v1/models/${model}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      const latest = data?.latest_version?.id;
      if (latest) return latest;
    } else {
      console.warn(`Siren Song version lookup failed: HTTP ${res.status}`);
    }
  } catch (e) {
    console.warn('Siren Song version lookup failed:', e.message);
  }

  const pinned = secrets.get('SIREN_SONG_VERSION');
  if (!pinned) {
    throw new Error(
      'Could not resolve a Siren Song version: the Replicate model lookup failed ' +
      'and no SIREN_SONG_VERSION fallback is set.'
    );
  }
  console.warn('Using pinned SIREN_SONG_VERSION fallback:', pinned);
  return pinned;
}