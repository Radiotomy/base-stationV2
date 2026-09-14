/**
 * Rebuild a 243 Masters brief from the flat masters_* fields a lyric asset stores.
 *
 * A Masters run produces far more than words — key, BPM, chord progression,
 * arrangement and the production brief that fills the sound description. Those
 * live as separate metadata fields, so loading only the lyrics silently drops
 * everything that made it a Masters track. Returns null when the asset was not
 * written by the Masters engine.
 */
export function mastersBriefFromAsset(asset) {
  const meta = asset?.metadata || {};
  if (!meta.masters_brief) return null;
  return {
    title: asset.title,
    key: meta.masters_key,
    bpm: meta.masters_bpm,
    chord_progression: meta.masters_chord_progression || [],
    arrangement: meta.masters_arrangement || [],
    production_brief: meta.masters_brief,
    masters_used: meta.masters_used || [],
  };
}