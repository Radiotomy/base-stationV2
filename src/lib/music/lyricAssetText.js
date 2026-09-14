/**
 * Resolve the actual lyric text of a saved 'lyric' UserAsset.
 *
 * Lyrics Studio writes the words to a .txt file and only SOMETIMES mirrors them
 * into metadata.content, so reading metadata alone yields nothing for most saved
 * lyrics. `description` and `title` are a one-line summary and a name — never the
 * lyric — so they are not used as substitutes: handing a title to a generator
 * looks like it worked while passing no lyrics at all.
 */
export async function loadLyricAssetText(asset) {
  const inline = asset?.metadata?.content;
  if (inline && inline.trim()) return inline;

  if (asset?.file_url) {
    const res = await fetch(asset.file_url);
    if (res.ok) {
      const text = await res.text();
      if (text.trim()) return text;
    }
  }
  return '';
}