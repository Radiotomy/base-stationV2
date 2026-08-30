// trackCoverArt — one place that turns a SONG into album artwork.
//
// Cover art belongs to musical tracks only: loops, one-shots, SFX and stems are
// production material, not releases, so nothing here is wired into those paths.
//
// Every generated cover is produced with the platform's own image model. An
// earlier build routed the Cover Art Studio at a Tempolor image endpoint that
// does not exist (Tempolor is a music API), which is why every studio attempt
// failed — there is no external image provider to fall back to.

/**
 * Compose an album-cover prompt from whatever the caller actually knows about
 * the track. Deliberately tolerant: a Siren Song job carries only style tags,
 * while a Harmonix job carries a full sound prompt, and both must yield art.
 */
export function buildTrackCoverPrompt({ title, prompt, genre, mood, tags }: {
  title?: string;
  prompt?: string;
  genre?: string;
  mood?: string;
  tags?: string;
} = {}) {
  const descriptor = [prompt, tags, genre, mood]
    .map((v) => (v || '').toString().trim())
    .filter(Boolean)
    .join(', ')
    .slice(0, 400);

  const named = (title || '').trim();

  return [
    'Album cover artwork for a music release',
    named ? `titled "${named.slice(0, 80)}"` : '',
    descriptor ? `Musical character: ${descriptor}.` : '',
    'Square composition, bold striking focal point, rich cohesive color palette,',
    'dramatic lighting, professional music-industry finish.',
    'No text, no lettering, no watermarks, no logos.',
  ].filter(Boolean).join(' ');
}

/**
 * Generate cover artwork and return its URL, or null if generation failed.
 *
 * Never throws: artwork is a presentation nicety layered on top of an audio
 * render that already succeeded and was already paid for. A failed image must
 * leave the track saved and playable rather than failing the whole job.
 */
export async function generateTrackCover(base44, details) {
  try {
    const img = await base44.asServiceRole.integrations.Core.GenerateImage({
      prompt: buildTrackCoverPrompt(details),
    });
    return img?.url || null;
  } catch (err) {
    console.warn('Track cover art generation failed:', err?.message);
    return null;
  }
}