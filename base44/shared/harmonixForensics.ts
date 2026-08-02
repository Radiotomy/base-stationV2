// BASE-Harmonix — forensic-native generation path.
//
// REALITY CHECK, so nobody plans against a fiction: Harmonix runs on the public
// Replicate model fishaudio/ace-step-1.5. We do NOT own that container, so we
// cannot inject the mark inside the model's inference graph — that would require
// forking ACE-Step into our own cog image first.
//
// What we CAN do today, and what this module does: the V1 spectral layer is pure
// server-side DSP (base44/shared/baseMark.ts) with no GPU and no external call.
// So the moment the generated master lands in this function's memory, we mark it
// and upload ONCE. No save-then-re-upload, no second job, no extra round trip.
// Measured cost is the DSP pass itself — sub-second on a 3-minute master.
//
// V2 (neural) and V3 (drift) still require Replicate GPU containers, so they stay
// on the existing asynchronous auto-mark path and are NOT run inline here.

import { embedMark, parseWav, payloadFromId, BASE_MARK_VERSION } from './baseMark.ts';

// Only PCM WAV can carry the V1 mark. mp3 output cannot be marked inline without
// a decode/re-encode that would destroy the mark anyway, so callers that want
// inline forensics must request WAV from the model.
export const FORENSIC_AUDIO_FORMAT = 'wav';

/**
 * Mark generated audio in-memory.
 * Returns the marked bytes plus the provenance record to persist on the job.
 * Never throws — if the bytes are not markable, it returns the originals with
 * a reason, so a forensics problem can never fail a paid generation.
 */
export function markGeneratedAudio(bytes, seedId) {
  try {
    const wav = parseWav(bytes);
    if (!wav || wav.audioFormat !== 1 || (wav.bitsPerSample !== 16 && wav.bitsPerSample !== 24)) {
      return { bytes, provenance: null, skipped: 'Not a 16/24-bit PCM WAV' };
    }
    const payloadHex = payloadFromId(seedId);
    const marked = embedMark(bytes, payloadHex);
    return {
      bytes: marked,
      provenance: {
        version: BASE_MARK_VERSION,
        payload_hex: payloadHex,
        embedded_at: new Date().toISOString(),
        inline: true,
        layers: ['spectral'],
        pending_layers: ['neural', 'drift'],
      },
      skipped: null,
    };
  } catch (e) {
    return { bytes, provenance: null, skipped: e.message };
  }
}