import { Captions } from 'lucide-react';
import InfoTip from '@/components/common/InfoTip';

const STYLES = [
  { v: 'karaoke', label: 'Karaoke highlight', hint: 'Each word lights up as it’s sung' },
  { v: 'clean', label: 'Clean subtitles', hint: 'Plain white subtitles, no highlight' },
];

/**
 * Auto-captions from the vocal track — Shotstack transcribes the audio and
 * renders word-level captions. Requires an audio track.
 */
export default function CaptionsToggle({ enabled, style, onToggle, onStyleChange, disabled }) {
  return (
    <div className="p-4 rounded-xl bg-card border border-border space-y-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          disabled={disabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="w-4 h-4 accent-indigo-500 disabled:opacity-40"
        />
        <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
          <Captions className="w-3.5 h-3.5" /> Auto-Captions
          <InfoTip text="Transcribes your vocal track and burns word-synced captions into the video. Adds 4 credits." />
        </span>
      </label>

      {disabled && (
        <p className="text-[10px] text-amber-400">Add an audio track first — captions are generated from it.</p>
      )}

      {enabled && !disabled && (
        <div className="flex gap-2">
          {STYLES.map((s) => (
            <button
              key={s.v}
              type="button"
              onClick={() => onStyleChange(s.v)}
              title={s.hint}
              className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                style === s.v
                  ? 'border-indigo-500 bg-indigo-500/10 text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-indigo-500/40'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}