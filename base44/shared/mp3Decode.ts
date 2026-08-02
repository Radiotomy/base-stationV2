// Audio container detection for the generation pipeline.
//
// Providers differ in what they hand back: Replicate's Stable Audio endpoint
// emits MP3, ACE-Step emits WAV. Everything downstream — the loop finishing
// stage and BASE Mark V1 spectral marking — needs raw PCM, so we need to know
// which one arrived before deciding what can be applied.
//
// NOTE (2026-08-02): server-side MP3 decoding is not currently possible in this
// runtime. `mpg123-decoder` (and the wasm-audio-decoders family generally)
// subclasses `Worker` at module eval and hangs indefinitely during WASM
// instantiation here — verified by probe, not assumed. Until decoding moves to
// the browser (OfflineAudioContext, already used by src/utils/decodeCompressedAudio.js),
// MP3 payloads pass through untouched and are labelled honestly as MP3 rather
// than being renamed to .wav.

export function isMp3(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true; // 'ID3'
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;                       // MPEG frame sync
}

export function isWav(bytes: Uint8Array): boolean {
  return bytes.length > 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46; // 'RIFF'
}

/** 'wav' | 'mp3' | 'unknown' — drives both polish eligibility and file naming. */
export function detectFormat(bytes: Uint8Array): 'wav' | 'mp3' | 'unknown' {
  if (isWav(bytes)) return 'wav';
  if (isMp3(bytes)) return 'mp3';
  return 'unknown';
}