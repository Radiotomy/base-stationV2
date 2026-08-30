import { Sparkles, Wand2, Info } from 'lucide-react';
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
  const hasRef = !!value.referenceUrl.trim();
  const hasPrompt = !!value.stylePrompt.trim();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-violet-400" /> Style Prompt
          <InfoTip text="Write this as a SENTENCE, not tags. Skye steers on natural language — describe genre, instruments, production and feel, e.g. 'Red dirt country with acoustic guitar, driving fiddle and warm analog warmth'." />
        </p>
        <textarea value={value.stylePrompt} onChange={(e) => set({ stylePrompt: e.target.value })}
          rows={3} disabled={disabled || hasRef}
          placeholder={hasRef ? 'Disabled — a reference recording is setting the style' : 'Red dirt country, acoustic guitar, driving fiddle, warm analog warmth'}
          className="w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none disabled:opacity-50" />
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          <Wand2 className="w-3 h-3 text-cyan-400" /> Reference Style URL
          <InfoTip text="Zero-shot style cloning: paste a public link to an audio file and Skye matches its sonic character. Only use recordings you have the rights to reference." />
        </p>
        <input type="url" value={value.referenceUrl} onChange={(e) => set({ referenceUrl: e.target.value })}
          disabled={disabled || hasPrompt}
          placeholder={hasPrompt ? 'Disabled — a style prompt is already set' : 'https://…/reference.wav'}
          className="w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50" />
      </div>

      <div className="p-2.5 rounded-lg bg-muted/40 border border-border flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground">
          Skye takes its style from a written prompt <span className="font-semibold">or</span> a reference recording — clear one to use the other.
        </p>
      </div>
    </div>
  );
}