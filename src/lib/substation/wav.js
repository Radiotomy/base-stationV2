// Minimal 16-bit PCM WAV encoder for SUB-Station bounces.
// Kept local to the module so a bounce never depends on the mastering utils.
export function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const len = buffer.length;
  const sampleRate = buffer.sampleRate;
  const channels = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));

  const dataLength = len * numCh * 2;
  const out = new DataView(new ArrayBuffer(44 + dataLength));

  const str = (offset, s) => { for (let i = 0; i < s.length; i++) out.setUint8(offset + i, s.charCodeAt(i)); };

  str(0, 'RIFF');
  out.setUint32(4, 36 + dataLength, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, numCh, true);
  out.setUint32(24, sampleRate, true);
  out.setUint32(28, sampleRate * numCh * 2, true);
  out.setUint16(32, numCh * 2, true);
  out.setUint16(34, 16, true);
  str(36, 'data');
  out.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      out.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([out.buffer], { type: 'audio/wav' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}