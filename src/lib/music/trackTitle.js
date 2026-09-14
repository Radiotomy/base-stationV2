/**
 * Automated track/song title naming convention.
 *
 * Tracks were being filed as "Energetic Hip-Hop — Sonic": a style label plus the
 * rendering engine, which is metadata about HOW it was made, never a song name.
 * This resolves a real title from the song's own content, in strict priority:
 *
 *   1. The creator's own typed title — always wins.
 *   2. The title the model returned with the song.
 *   3. The 243 Masters brief title (Masters names the song it wrote).
 *   4. The lyric hook — first real lyric line, section tags like [Chorus] skipped.
 *   5. The opening phrase of the sound description.
 *   6. Only if all else is empty: "<Mood> <Genre>" — with no provider or model,
 *      because engine names must never appear in a song title.
 */

const MAX_LEN = 60;

const titleCase = (s) => s
  .split(/\s+/)
  .map(w => w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w)
  .join(' ');

const clean = (s) => (s || '')
  .replace(/["“”]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/** First singable lyric line — [Verse]/(Chorus) markers and blanks are not titles. */
function hookFromLyrics(lyrics) {
  const line = (lyrics || '')
    .split('\n')
    .map(l => clean(l).replace(/^[[(].*?[\])]\s*/, '').replace(/[.,!?;:]+$/, ''))
    .find(l => l.length >= 3 && !/^[[(]/.test(l));
  if (!line) return '';
  const words = line.split(' ').slice(0, 7).join(' ');
  return titleCase(words.slice(0, MAX_LEN));
}

function phraseFromPrompt(prompt) {
  const words = clean(prompt).replace(/[.,;:].*$/, '').split(' ').slice(0, 5).join(' ');
  return words.length >= 3 ? titleCase(words.slice(0, MAX_LEN)) : '';
}

export function resolveTrackTitle({
  customTitle = '',
  providerTitle = '',
  mastersTitle = '',
  lyrics = '',
  soundPrompt = '',
  genre = '',
  mood = '',
} = {}) {
  return clean(customTitle)
    || clean(providerTitle)
    || clean(mastersTitle)
    || hookFromLyrics(lyrics)
    || phraseFromPrompt(soundPrompt)
    || clean(`${mood} ${genre}`)
    || 'Untitled Track';
}