/**
 * Encode an AudioBuffer (mono or stereo) to a PCM WAV Blob.
 *
 * Supports 16-bit and 24-bit (signed little-endian PCM, format code 1).
 * 24-bit is the standard for Apple Music / Spotify HQ / mastering submissions.
 *
 * @param {AudioBuffer} buffer
 * @param {Object} [opts]
 * @param {16|24} [opts.bitDepth=16]
 */
export function audioBufferToWav(buffer, opts = {}) {
  const bitDepth = opts.bitDepth === 24 ? 24 : 16;
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate  = buffer.sampleRate;
  const numFrames   = buffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign  = numChannels * bytesPerSample;
  const byteRate    = sampleRate * blockAlign;
  const dataSize    = numFrames * blockAlign;
  const bufferSize  = 44 + dataSize;

  const ab = new ArrayBuffer(bufferSize);
  const view = new DataView(ab);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);          // PCM chunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleaved samples
  const channels = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  if (bitDepth === 16) {
    for (let i = 0; i < numFrames; i++) {
      for (let c = 0; c < numChannels; c++) {
        let s = Math.max(-1, Math.min(1, channels[c][i]));
        s = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(offset, s, true);
        offset += 2;
      }
    }
  } else {
    // 24-bit signed PCM, little-endian: write 3 bytes per sample.
    for (let i = 0; i < numFrames; i++) {
      for (let c = 0; c < numChannels; c++) {
        const clamped = Math.max(-1, Math.min(1, channels[c][i]));
        const intVal = Math.round(clamped < 0 ? clamped * 0x800000 : clamped * 0x7FFFFF);
        const u = intVal < 0 ? intVal + 0x1000000 : intVal; // two's-complement 24-bit
        view.setUint8(offset,     u & 0xFF);
        view.setUint8(offset + 1, (u >> 8) & 0xFF);
        view.setUint8(offset + 2, (u >> 16) & 0xFF);
        offset += 3;
      }
    }
  }

  return new Blob([ab], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}