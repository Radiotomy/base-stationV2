import InfoTip from '@/components/common/InfoTip';
import { TRACK_GENRES, TRACK_MOODS } from '@/config/trackTaxonomy';

/**
 * Release metadata for a generated track — genre and mood.
 *
 * Separate from whatever conditioning channel the engine uses (tags, style
 * prompt, caption fields): those steer the sound, these travel with the finished
 * recording into the library and on to Audius. A track saved without them ships
 * as an unlabelled release, so the picker sits in every studio rather than only
 * the ones whose model happens to take a genre parameter.
 */
export default function GenreMoodPicker({ genre, mood, onChange, disabled }) {
  const cls = 'w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          Genre
          <InfoTip text="Release metadata for your library and for streaming platforms. Left unset, the track publishes with no genre and platforms fall back to a default." />
        </p>
        <select value={genre || ''} disabled={disabled} className={cls}
          onChange={(e) => onChange({ genre: e.target.value, mood })}>
          <option value="">Not set</option>
          {TRACK_GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          Mood
          <InfoTip text="Optional release mood. Streaming platforms accept only a fixed set of values, so this list matches theirs exactly." />
        </p>
        <select value={mood || ''} disabled={disabled} className={cls}
          onChange={(e) => onChange({ genre, mood: e.target.value })}>
          <option value="">Not set</option>
          {TRACK_MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}