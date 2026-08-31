import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Music2 } from 'lucide-react';

const EXAMPLE = `# syllable  note  beats
Twin  C4  1
kle   C4  1
lit   G4  1
tle   G4  1
star  A4  2`;

/**
 * The authored melody. This is the part that makes the whole feature defensible:
 * these exact pitches are what the engine sings, so the vocal line is human by
 * construction rather than inferred from prompt telemetry.
 */
export default function MelodySheetInput({ value, onChange, notes, errors, seconds }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-black">Melody</h3>
        <span className="text-[11px] text-muted-foreground">syllable · note · beats</span>
      </div>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={12}
        placeholder={EXAMPLE}
        className="rounded-xl font-mono text-xs leading-relaxed"
      />

      <div className="flex items-center gap-3 text-[11px]">
        <span className="flex items-center gap-1 font-bold text-emerald-400">
          <Music2 className="w-3 h-3" />
          {notes.length} notes
        </span>
        {seconds > 0 && (
          <span className="text-muted-foreground">
            ≈ {Math.floor(seconds / 60)}:{String(Math.round(seconds % 60)).padStart(2, '0')}
          </span>
        )}
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 space-y-1">
          <p className="text-[11px] font-bold flex items-center gap-1 text-destructive">
            <AlertTriangle className="w-3 h-3" />
            {errors.length} line{errors.length === 1 ? '' : 's'} skipped
          </p>
          {errors.slice(0, 5).map(e => (
            <p key={e.line} className="text-[11px] text-muted-foreground">
              Line {e.line}: {e.message}
            </p>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Lengths accept <code>1</code>, <code>0.5</code> or <code>1/4</code>. Lines starting
        with <code>#</code> are comments.
      </p>
    </div>
  );
}