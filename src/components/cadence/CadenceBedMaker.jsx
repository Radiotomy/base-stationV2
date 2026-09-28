import { useState } from 'react';
import { Guitar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { renderCadenceBed } from '@/lib/cadence/renderCadenceBed';

/** Compact "chords in, instrumental bed out" Cadence control. Calls onReady(asset). */
export default function CadenceBedMaker({ bpm = 120, onReady, title = 'Cadence bed', dark }) {
  const [chords, setChords] = useState('C | Am | F | G');
  const [style, setStyle] = useState('');
  const [seconds, setSeconds] = useState(30);
  const [busy, setBusy] = useState(false);
  const field = dark ? 'h-8 text-xs bg-black/40 border-white/10' : 'h-9 text-sm';

  const go = async () => {
    if (!chords.trim() || !style.trim()) { toast.error('Add chords and describe the instruments'); return; }
    setBusy(true);
    try {
      const asset = await renderCadenceBed({ title: `${title} — ${chords.slice(0, 40)}`, chords, bpm, style, duration: seconds });
      toast.success('Cadence bed ready');
      onReady?.(asset);
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-2">
      <Input value={chords} onChange={(e) => setChords(e.target.value)} placeholder="C | Am | F | G7" className={field} disabled={busy} />
      <Input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="warm Rhodes, soft bass, brushed feel" className={field} disabled={busy} />
      <label className="block text-[11px] text-muted-foreground">Length — {seconds}s · {bpm} BPM
        <input type="range" min={8} max={120} step={2} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className="w-full" disabled={busy} />
      </label>
      <Button size="sm" variant="outline" onClick={go} disabled={busy} className="w-full gap-2">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Guitar className="w-3.5 h-3.5" />}
        {busy ? 'Cadence is playing your chords…' : 'Render bed from these chords'}
      </Button>
      <p className="text-[10px] text-muted-foreground">Free · non-commercial drafting only (Cadence model licence). One bed renders at a time.</p>
    </div>
  );
}