import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * masterTrack — RETIRED.
 *
 * This endpoint used to "master" a track by copying the source file URL onto a
 * new `master` asset, charging 6 credits, and stamping metadata that asserted a
 * LUFS target, an EQ curve and a compression profile had been applied. None of
 * it was: the delivered file was the source file, byte for byte. On a platform
 * whose entire value proposition is verifiable provenance, metadata claiming
 * processing that never happened is the most damaging thing this function could
 * produce — worse than the wasted credits, because a Creative Ownership Score
 * and a BASE Mark cascade were being attached to a fabricated derivation.
 *
 * Real mastering already exists and is CLIENT-SIDE, because that is where the
 * audio can actually be processed: `src/utils/offlineMastering.js` renders the
 * full chain (balance → mid/side → 7-zone parametric EQ → saturator → sub shelf
 * → radio band → convolution reverb → compressor → LUFS makeup → optional
 * Foundry insert) through an OfflineAudioContext, encodes real PCM WAV, uploads
 * it, and saves the asset. `AIMasteringPanel` is the surface that drives it.
 *
 * This function is deliberately left in place returning an explicit error rather
 * than deleted: a caller that reappears must FAIL LOUDLY and be pointed at the
 * real renderer. Silently deleting it would turn a visible 410 into a confusing
 * 404, and silently "fixing" it server-side would mean shipping a second,
 * divergent mastering implementation whose output no creator ever auditioned.
 */

const REPLACEMENT = 'Mastering runs in the Mastering Studio, which renders the audio in the browser and saves a real processed WAV. Open the studio and use "Master with AI" instead of calling this endpoint.';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  return Response.json({
    error: 'masterTrack has been retired because it did not process audio.',
    detail: REPLACEMENT,
    charged: false,
  }, { status: 410 });
});