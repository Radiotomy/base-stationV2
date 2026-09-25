/** Saves a base64-encoded MIDI payload as a .mid file. */
export default function downloadBase64Midi(b64, title = 'score') {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${String(title).replace(/[^\w\- ]+/g, '').trim() || 'score'}.mid`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}