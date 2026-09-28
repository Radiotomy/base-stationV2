import { useState } from 'react';
import { Loader2, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useBridgeSession } from './BridgeSessionContext';
import { buildDemoSong, DEMO, SECTIONS } from '@/lib/audiotool/demoSong';

const BAR_SEC = (60 / DEMO.bpm) * 4;
const fmt = (bars) => { const s = Math.round(bars * BAR_SEC); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export default function DemoSongPanel() {
  const { nexus, onChanged } = useBridgeSession() || {};
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const build = async () => {
    setBusy(true);
    try {
      const res = await buildDemoSong(nexus);
      setDone(res);
      onChanged?.();
      toast.success(`"${DEMO.title}" written to your project`);
    } catch (e) {
      toast.error(e.message || 'Could not write the demo song');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold">{DEMO.title} — hackathon demo song</h4>
        <p className="text-sm text-muted-foreground">
          A complete melodic house arrangement ({DEMO.key}, {DEMO.bpm} BPM, {DEMO.bars} bars ≈ {fmt(DEMO.bars)}).
          It adds 5 tracks (kick, sub bass, pad chords, pluck arp, lead hook) with named, coloured regions for every section,
          and sets the project tempo. Use it in an empty project, then open the same project in Audiotool to compare.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map(([name, start, len]) => (
          <span key={name} className="rounded-full bg-secondary px-2.5 py-1 text-xs">
            {name} · {fmt(start - 1)}–{fmt(start - 1 + len)}
          </span>
        ))}
      </div>
      <Button onClick={build} disabled={busy || !nexus} className="merc-button gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        {done ? 'Build again' : 'Build demo song'}
      </Button>
      {done && <p className="text-xs text-muted-foreground">Added {done.tracks} tracks and {done.regions} regions. Press play in Audiotool to hear it.</p>}
    </div>
  );
}