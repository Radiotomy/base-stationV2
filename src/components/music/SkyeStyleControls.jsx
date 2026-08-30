import { Sparkles, Ban, Wand2 } from 'lucide-react';
import InfoTip from '@/components/common/InfoTip';

const DEFAULT_NEGATIVE = 'low quality, distorted, muffled, amateur recording, artifacts';

/**
 * Skye's three text-conditioning channels, kept in their own component because
 * DiffRhythm 2 steers on prose + a SEPARATE negative channel + an optional
 * reference recording — a shape no other model in the catalog has.
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
          className="w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          <Ban className="w-3 h-3 text-rose-400" /> Negative Prompt
          <InfoTip text="What Skye should steer AWAY from. This is its own conditioning channel, so you never have to phrase a flaw as something you want." />
        </p>
        <textarea value={value.negativePrompt} onChange={(e) => set({ negativePrompt: e.target.value })}
          rows={2} disabled={disabled}
          placeholder={DEFAULT_NEGATIVE}
          className="w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
        {value.negativePrompt !== DEFAULT_NEGATIVE && (
          <button type="button" onClick={() => set({ negativePrompt: DEFAULT_NEGATIVE })}
            className="mt-1.5 text-[11px] text-muted-foreground hover:text-foreground underline">
            Reset to recommended
          </button>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          <Wand2 className="w-3 h-3 text-cyan-400" /> Reference Style URL (Optional)
          <InfoTip text="Zero-shot style cloning: paste a public link to an audio file and Skye matches its sonic character. Only use recordings you have the rights to reference." />
        </p>
        <input type="url" value={value.referenceUrl} onChange={(e) => set({ referenceUrl: e.target.value })}
          disabled={disabled}
          placeholder="https://…/reference.wav"
          className="w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
      </div>
    </div>
  );
}