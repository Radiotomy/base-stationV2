import { Sparkles, Wand2 } from 'lucide-react';
import InfoTip from '@/components/common/InfoTip';

/**
 * Skye's style conditioning. DiffRhythm 2 embeds style through MuLan, which
 * accepts EITHER a text prompt OR a reference recording — never both. Passing a
 * reference makes the model ignore the prose entirely, so the two inputs are
 * presented as mutually exclusive rather than letting a creator write a
 * description the model will never read.
 *
 * There is deliberately no negative-prompt field: the real inference signature
 * has no negative channel, so offering one would be a control that does nothing.
 */
export default function SkyeStyleControls({ value, onChange, disabled }) {
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-violet-400" /> Style Prompt
          <InfoTip text="Write this as a SENTENCE, not tags. Skye steers on natural language — describe genre, instruments, production and feel, e.g. 'Red dirt country with acoustic guitar, driving fiddle and warm analog warmth'." />
        </p>
        <textarea value={value.stylePrompt} onChange={(e) => set({ stylePrompt: e.target.value })}
          rows={3} disabled={disabled}
          placeholder="Red dirt country, acoustic guitar, driving fiddle, warm analog warmth"
          className="w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none disabled:opacity-50" />
      </div>

      <div className="p-2.5 rounded-lg bg-muted/40 border border-border flex items-start gap-2">
        <Wand2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground">
          Reference-audio style cloning isn't available in the current Skye engine build — it will return here once the Space exposes it again.
        </p>
      </div>
    </div>
  );
}