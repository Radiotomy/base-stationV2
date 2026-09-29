import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Music2, Undo2, Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseChart, writeProgression } from '@/lib/audiotool/chordWriter';
import { undoRegion } from '@/lib/audiotool/midiCoProducer';
import { unwrap } from '@/lib/audiotool/nexusErrors';
import ChordPadGrid from './ChordPadGrid';
import LeadSheetChordImport from './LeadSheetChordImport';
import ChordSuggestPanel from './ChordSuggestPanel';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';
import { logInvocation, deleteInvocation } from '@/lib/audiotool/nexusTelemetry';

const lbl = 'flex flex-col gap-1 text-[10px] uppercase tracking-widest text-muted-foreground';

export default function ChordProgressionPanel({ nexus, projectUrl, connected, onChanged }) {
  const [aiPicks, setAiPicks] = useState([]);
  const [chart, setChart] = useState('C | Am | F | G');
  const [barsPerChord, setBarsPerChord] = useState(1);
  const [trackId, setTrackId] = useState('');
  const [last, setLast] = useState(null);
  const [busy, setBusy] = useState('');
  const chords = parseChart(chart);

  const write = async () => {
    setBusy('write');
    try {
      const r = unwrap(await writeProgression(nexus, { chords, barsPerChord, trackId, label: chords.join(' ') }));
      setTrackId(r.trackId);
      const picked = aiPicks.filter((c) => chords.includes(c));
      const ev = picked.length ? await logInvocation(projectUrl, {
        tool: 'chord_suggest', prompt: `ChordSeqAI suggested: ${picked.join(', ')}`, collectionIds: [r.collectionId],
      }) : null;
      setAiPicks([]);
      setLast({ ...r, eventId: ev?.id });
      toast.success(`${chords.length} chords written at bar ${r.bar}`);
      onChanged?.();
    } catch (e) { toast.error(`Audiotool rejected the progression — ${e.message}`); }
    setBusy('');
  };

  const undo = async () => {
    setBusy('undo');
    try {
      unwrap(await undoRegion(nexus, { ...last, trackId: null }));
      if (last.eventId) await deleteInvocation(last.eventId);
      setLast(null); onChanged?.();
    }
    catch (e) { toast.error(`Couldn't undo — ${e.message}`); }
    setBusy('');
  };

  return (
    <section className="merc-card rounded-3xl p-5 space-y-4">
      <div>
        <h3 className="font-bold flex items-center gap-2"><Music2 className="w-4 h-4 text-accent" /> Chord Progression <InfoTip text={TIPS.chordProgression} /></h3>
        <p className="text-sm text-muted-foreground">Tap pads or type a chart — it lands on its own pad synth track. Written by you, so it all counts as human.</p>
      </div>
      <ChordPadGrid onPick={(c) => setChart((v) => (v.trim() ? `${v} | ${c}` : c))} />
      <label className={lbl}>Progression
        <Input value={chart} onChange={(e) => setChart(e.target.value)} placeholder="C | Am | F | G7" className="normal-case tracking-normal text-foreground font-mono" />
      </label>
      <div className="flex flex-wrap gap-1.5 min-h-6">
        {chords.map((c, i) => <span key={i} className="rounded-full border border-border px-2.5 py-0.5 text-xs font-mono">{c}</span>)}
        {!chords.length && <span className="text-xs text-muted-foreground">No recognisable chords yet.</span>}
      </div>
      <ChordSuggestPanel chords={chords} onPick={(c) => { setAiPicks((p) => [...p, c]); setChart((v) => (v.trim() ? `${v} | ${c}` : c)); }} />
      <div className="grid sm:grid-cols-2 gap-3">
        <label className={lbl}>Length per chord
          <select value={barsPerChord} onChange={(e) => setBarsPerChord(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-popover px-2 text-sm normal-case tracking-normal text-foreground">
            <option value={1}>1 bar</option><option value={2}>2 bars</option><option value={4}>4 bars</option>
          </select>
        </label>
        <LeadSheetChordImport onImport={setChart} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className="merc-button" disabled={!chords.length || !connected || !!busy} onClick={write}>
          {busy === 'write' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Music2 className="w-4 h-4" />} Write to timeline
        </Button>
        <Button variant="outline" disabled={!last || !!busy} onClick={undo}><Undo2 className="w-4 h-4" /> Undo last</Button>
        <Button variant="ghost" disabled={!!busy} onClick={() => { setChart(''); setAiPicks([]); }}><Eraser className="w-4 h-4" /> Clear</Button>
      </div>
    </section>
  );
}