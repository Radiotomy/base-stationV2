import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const chip = (active) => `px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${active ? 'bg-cyan-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`;

/** Per-action inputs for sonicEditTrack. `value` is a flat params object. */
export default function SonicActionParams({ action, value, onChange, sourceDuration }) {
  const set = (patch) => onChange({ ...value, ...patch });

  if (action === 'remaster') return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Variation</p>
      <div className="flex gap-1.5">
        {['subtle', 'normal', 'high'].map(v => (
          <button key={v} onClick={() => set({ variation_category: v })} className={chip((value.variation_category || 'subtle') === v)}>{v}</button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">Variation intensity applies on Sonic v5; other models remaster at default depth.</p>
    </div>
  );

  if (action === 'concat') return (
    <p className="text-xs text-muted-foreground">Joins this extension clip onto its original into one continuous song. Only works on a track that came from an Extend.</p>
  );

  if (action === 'replace_section') return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Start (s)</p>
          <Input type="number" min={0} value={value.infill_start_s ?? ''} onChange={e => set({ infill_start_s: e.target.value })} className="rounded-xl" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">End (s)</p>
          <Input type="number" min={1} max={sourceDuration || undefined} value={value.infill_end_s ?? ''} onChange={e => set({ infill_end_s: e.target.value })} className="rounded-xl" />
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">New lyrics for this section</p>
        <Textarea rows={4} value={value.infill_lyrics || ''} onChange={e => set({ infill_lyrics: e.target.value })}
          placeholder={'[Verse 2]\nDancing in the rain\nForgetting all the pain'} className="rounded-xl text-xs" />
        <p className="text-[10px] text-muted-foreground mt-1">Keep the section tag and roughly the same line count as the original — Sonic matches timing to the surrounding lyrics.</p>
      </div>
    </div>
  );

  // add_vocals | add_instrumental
  return (
    <div className="space-y-3">
      {action === 'add_vocals' && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Lyrics to sing</p>
          <Textarea rows={5} value={value.lyrics || ''} onChange={e => set({ lyrics: e.target.value })}
            placeholder="[Verse 1]…" className="rounded-xl text-xs" />
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Style tags</p>
        <Input value={value.tags || ''} onChange={e => set({ tags: e.target.value })} placeholder="pop, upbeat, acoustic" className="rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">From (s)</p>
          <Input type="number" min={0} value={value.start_s ?? 0} onChange={e => set({ start_s: e.target.value })} className="rounded-xl" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">To (s)</p>
          <Input type="number" min={1} value={value.end_s ?? (sourceDuration || 30)} onChange={e => set({ end_s: e.target.value })} className="rounded-xl" />
        </div>
      </div>
      {action === 'add_vocals' && (
        <div className="flex gap-1.5">
          {[['f', 'Female'], ['m', 'Male']].map(([v, l]) => (
            <button key={v} onClick={() => set({ vocal_gender: v })} className={chip((value.vocal_gender || 'f') === v)}>{l}</button>
          ))}
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
          Keep original — <span className="text-foreground">{(value.audio_weight ?? 0.7).toFixed(2)}</span>
        </p>
        <input type="range" min={0} max={1} step={0.05} value={value.audio_weight ?? 0.7}
          onChange={e => set({ audio_weight: Number(e.target.value) })} className="w-full accent-cyan-500" />
      </div>
    </div>
  );
}