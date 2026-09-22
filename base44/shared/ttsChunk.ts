// Splits long speech text into parts a TTS engine will accept, breaking at
// sentence ends first and word boundaries only when a single sentence is too
// long. Inworld rejects any request over 2000 characters outright, so a
// podcast-length script has to be voiced in parts and stitched back together.

export function chunkSpeechText(text, maxLen = 1800) {
  const sentences = String(text).replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [];
  const chunks = [];
  let cur = '';
  const push = () => { if (cur.trim()) chunks.push(cur.trim()); cur = ''; };

  for (const s of sentences) {
    if (s.length > maxLen) {
      push();
      let piece = '';
      for (const w of s.split(' ')) {
        if ((piece + ' ' + w).length > maxLen) { chunks.push(piece.trim()); piece = ''; }
        piece += ' ' + w;
      }
      cur = piece;
      continue;
    }
    if ((cur + s).length > maxLen) push();
    cur += s;
  }
  push();
  return chunks;
}