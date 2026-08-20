// BASE Mark — refuse to neural-mark audio that is ALREADY one of our marked outputs.
//
// WHY THIS EXISTS (measured, 2026-08-20)
// The V2 backfill selected each asset's `metadata.wav_url || file_url`. For 15
// catalogue assets that url was itself a `basemark-v2.wav` produced by an
// EARLIER marking round — so the neural layer was embedded a second time on top
// of itself. The result is the worst possible outcome for a forensic instrument:
//
//   • the embed appears to succeed (the container returns audio, the bytes
//     genuinely change, the record is stamped `completed` with a payload), and
//   • NEITHER mark is recoverable afterwards — a decode of the finished file
//     returns nothing at all.
//
// So the registry ends up asserting a mark that does not physically exist. That
// is precisely the false claim FORENSIC_SPEC §2 and §8 are built to prevent,
// and it is worse than an unmarked asset, because an unmarked asset is honest.
//
// This is NOT the V1→V2 cascade, which is verified safe (smokeBaseMarkCascade
// asserts both layers resolve independently on the combined output). Those are
// two different technologies occupying different signal space. Neural-on-neural
// is the same technology competing with its own perturbations, and it is
// destructive.
//
// The guard is deliberately a source-URL check rather than a decode-first check:
// decoding every candidate before marking would add a GPU round trip per asset
// to prove a fact the filename already tells us, since these outputs are ours
// and we name them. A caller that needs certainty on foreign audio should decode
// first and pass `allowMarkedSource` only with a reason.
export const MARKED_OUTPUT_MARKER = 'basemark-v2';

/** True when this url is an output our own V2 embed produced. */
export function isMarkedOutputUrl(url: string): boolean {
  return typeof url === 'string' && url.toLowerCase().includes(MARKED_OUTPUT_MARKER);
}

/**
 * Pick the best marking source for an asset, preferring a pristine master.
 * Returns { url, reason } — url is null when nothing safe to mark remains, and
 * `reason` then explains why, so the caller can record an honest skip instead of
 * stamping a mark it cannot back up.
 */
export function selectMarkingSource(asset): { url: string | null; reason: string | null } {
  const wav = asset?.metadata?.wav_url || null;
  const file = asset?.file_url || null;

  // A pristine WAV is the ideal source: PCM, and not one of our outputs.
  if (wav && !isMarkedOutputUrl(wav)) return { url: wav, reason: null };
  // A pristine file_url is acceptable when it is not already marked.
  if (file && !isMarkedOutputUrl(file)) return { url: file, reason: null };

  if (!wav && !file) return { url: null, reason: 'no_audio_file' };
  return { url: null, reason: 'only_marked_copies_remain' };
}

/** Throwing form, for call sites that already resolved a url themselves. */
export function assertUnmarkedSource(url: string): string {
  if (isMarkedOutputUrl(url)) {
    throw new Error(
      'Refusing to mark: this audio is already a BASE Mark output. Re-marking a marked file destroys both signatures and would register a mark that cannot be recovered.',
    );
  }
  return url;
}