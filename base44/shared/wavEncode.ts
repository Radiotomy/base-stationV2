// Float32 channel data → 16/24-bit PCM WAV container.
//
// Lives on its own so both the loop finishing stage and the MP3 decode stage
// can produce identical containers without importing each other.

export function encodeWav(chans, sampleRate, bps) {
  const ch = chans.length;
  const frames = chans[0].length;
  const dataLen = frames * ch * bps;
  const out = new Uint8Array(44 + dataLen);
  const dv = new DataView(out.buffer);
  const str = (off, s) => { for (let i = 0; i < s.length; i++) out[off + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); str(8, 'WAVE');
  str(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * ch * bps, true);
  dv.setUint16(32, ch * bps, true); dv.setUint16(34, bps * 8, true);
  str(36, 'data'); dv.setUint32(40, dataLen, true);

  const maxV = bps === 2 ? 32767 : 8388607;
  let off = 44;
  for (let n = 0; n < frames; n++) {
    for (let c = 0; c < ch; c++) {
      let v = Math.round(chans[c][n] * (maxV + 1));
      if (v > maxV) v = maxV; else if (v < -maxV - 1) v = -maxV - 1;
      if (bps === 2) { dv.setInt16(off, v, true); off += 2; }
      else {
        out[off] = v & 0xff; out[off + 1] = (v >> 8) & 0xff; out[off + 2] = (v >> 16) & 0xff;
        off += 3;
      }
    }
  }
  return out;
}