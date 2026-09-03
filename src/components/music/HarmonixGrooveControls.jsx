import { Music2, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import InfoTip from '@/components/common/InfoTip';

const TIME_SIGS = [
  { value: 'auto', label: 'Auto' },
  { value: '4', label: '4/4' },
  { value: '3', label: '3/4' },
  { value: '6', label: '6/8' },
  { value: '2', label: '2/4' },
];

/**
 * Groove anchors for BASE-Harmonix (Coda engine).
 *
 * Tempo/key/time signature fold into the engine's tags channel so the model
 * isn't guessing the pocket. Inference controls are gone deliberately: the
 * XL Turbo engine fixes steps at 8 and disables CFG (guidance 1.0) — exposing
 * knobs the engine ignores would be misleading.
 */
export default function HarmonixGrooveControls({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex flex-wrap items-center gap-x-2 gap-y-0.5 px-4 py-3 text-left">
        <Music2 className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-bold">Groove &amp; Feel</span>
        <span className="text-[11px] text-muted-foreground">
          {value.bpm ? `${value.bpm} BPM` : 'auto tempo'}
          {value.key_scale ? ` · ${value.key_scale}` : ''}
        </span>
        <ChevronDown className={`w-4 h-4 ml-auto text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <p className="text-[11px] text-muted-foreground leading-snug">
            Pinning tempo and key stops CODA guessing the pocket — the main reason a
            band drifts or hesitates under the vocal, especially on R&amp;B and soul.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                BPM <InfoTip text="Leave blank to let the model choose. Classic soul sits around 60-80, R&B around 70-95." />
              </p>
              <input type="number" min={30} max={300} disabled={disabled}
                value={value.bpm ?? ''} onChange={e => set({ bpm: e.target.value ? Number(e.target.value) : null })}
                placeholder="auto"
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <div className="order-last sm:order-none col-span-2 sm:col-span-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Key</p>
              <input type="text" maxLength={20} disabled={disabled}
                value={value.key_scale || ''} onChange={e => set({ key_scale: e.target.value })}
                placeholder="e.g. Bb major"
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Time Sig</p>
              <select value={value.time_signature || 'auto'} disabled={disabled}
                onChange={e => set({ time_signature: e.target.value })}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {TIME_SIGS.map(t => <option key={t.value} value={t.value} className="bg-background">{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1">
              Seed <InfoTip text="Reuse the seed from a take you liked to keep the same groove while changing the lyrics or description." />
            </p>
            <input type="number" min={1} disabled={disabled}
              value={value.seed ?? ''} onChange={e => set({ seed: e.target.value ? Number(e.target.value) : null })}
              placeholder="random"
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          </div>
        </div>
      )}
    </div>
  );
}