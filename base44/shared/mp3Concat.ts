// Joins several MP3 files into one playable MP3.
//
// Why byte-level and not a real mixdown: MP3 cannot be DECODED in this runtime
// (see shared/mp3Decode.ts — the wasm decoder family hangs at WASM
// instantiation here, verified by probe). So there is no PCM stage available
// server-side to concatenate properly.
//
// Frame concatenation is sound for THIS input only: every part comes from the
// same TTS engine at the same sample rate and bitrate, so the frames are
// mutually compatible and players stream straight through the joins. Metadata
// tags are the one thing that must go — an ID3v2 header sitting in the middle
// of a stream is garbage between frames, and a trailing ID3v1 block is a
// 128-byte burst of noise. We strip both from every part and let the caller
// decide what tags the finished file carries.
//
// Deliberately NOT used for music masters: anything heading into BASE Mark
// wants a real PCM path, per the mark-once/compress-last rule.

function id3v2Length(bytes: Uint8Array): number {
  // 'ID3' + version(2) + flags(1) + syncsafe size(4); size excludes the 10-byte header.
  if (bytes.length < 10) return 0;
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0;
  const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  const footer = (bytes[5] & 0x10) ? 10 : 0;
  return 10 + size + footer;
}

function hasId3v1(bytes: Uint8Array): boolean {
  if (bytes.length < 128) return false;
  const off = bytes.length - 128;
  return bytes[off] === 0x54 && bytes[off + 1] === 0x41 && bytes[off + 2] === 0x47; // 'TAG'
}

/** Strips container tags so the part is nothing but audio frames. */
export function stripMp3Tags(bytes: Uint8Array): Uint8Array {
  let start = id3v2Length(bytes);
  let end = bytes.length;
  if (hasId3v1(bytes)) end -= 128;
  if (start >= end) return new Uint8Array(0);
  return bytes.subarray(start, end);
}

/** Frame-concatenates same-format MP3 parts into one continuous stream. */
export function concatMp3(parts: Uint8Array[]): Uint8Array {
  const stripped = parts.map(stripMp3Tags).filter((p) => p.length > 0);
  const total = stripped.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of stripped) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}