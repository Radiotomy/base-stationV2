import { Input } from '@/components/ui/input';

const KEYS = ['C major', 'G major', 'D major', 'A major', 'F major', 'Bb major',
  'A minor', 'E minor', 'B minor', 'D minor', 'G minor', 'F# minor'];

/** Key / BPM / time signature — the frame the melody's beat lengths are read against. */
export default function ScoreMetaBar({ meta, onChange }) {
  const set = (patch) => onChange({ ...meta, ...patch });

  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="text-[11px] font-bold text-muted-foreground">Key</label>
        <select
          value={meta.key}
          onChange={(e) => set({ key: e.target.value })}
          className="w-full mt-1 h-9 rounded-lg bg-input border border-border px-2 text-sm"
        >
          {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[11px] font-bold text-muted-foreground">BPM</label>
        <Input
          type="number" min={40} max={240} value={meta.bpm}
          onChange={(e) => set({ bpm: Number(e.target.value) })}
          className="mt-1 h-9 rounded-lg"
        />
      </div>
      <div>
        <label className="text-[11px] font-bold text-muted-foreground">Time</label>
        <select
          value={meta.time_signature}
          onChange={(e) => set({ time_signature: e.target.value })}
          className="w-full mt-1 h-9 rounded-lg bg-input border border-border px-2 text-sm"
        >
          {['4/4', '3/4', '6/8', '2/4', '5/4'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    </div>
  );
}