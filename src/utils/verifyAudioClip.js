// Prepares an audio file for server-side BASE Mark verification.
// Decodes any browser-supported format (WAV/MP3/OGG/M4A/WebM/FLAC) to mono
// 44.1kHz PCM, clips to the first 30 seconds (the mark repeats continuously,
// so a short snippet is enough), and returns a base64 16-bit mono WAV.
// Detection itself happens server-side — no watermark logic ships to the browser.

const MAX_SECONDS = 30;

function writeStr(dv, off, s) {
  for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
}

export async function fileToVerifySnippetB64(file) {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: 1, sampleRate: 44100 });
  const buf = await ctx.decodeAudioData(arrayBuffer);

  const frames = Math.min(buf.length, MAX_SECONDS * buf.sampleRate);
  const ch = buf.numberOfChannels;
  const mono = new Float32Array(frames);
  for (let c = 0; c < ch; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < frames; i++) mono[i] += d[i] / ch;
  }

  // 16-bit mono WAV
  const dataLen = frames * 2;
  const out = new ArrayBuffer(44 + dataLen);
  const dv = new DataView(out);
  writeStr(dv, 0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); writeStr(dv, 8, 'WAVE');
  writeStr(dv, 12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  writeStr(dv, 36, 'data'); dv.setUint32(40, dataLen, true);
  for (let i = 0; i < frames; i++) {
    const v = Math.max(-1, Math.min(1, mono[i]));
    dv.setInt16(44 + i * 2, v < 0 ? v * 32768 : v * 32767, true);
  }

  // base64 (chunked to avoid call-stack limits)
  const bytes = new Uint8Array(out);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}