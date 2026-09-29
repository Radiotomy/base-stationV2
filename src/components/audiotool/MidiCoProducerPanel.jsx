import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wand2, RefreshCw } from 'lucide-react';
import { listNoteRegions, readNotes, transformNotes, writeRegion, undoRegion, PRESETS, PLACEMENTS } from '@/lib/audiotool/midiCoProducer';
import { logInvocation, deleteInvocation } from '@/lib/audiotool/nexusTelemetry';
import { unwrap } from '@/lib/audiotool/nexusErrors';
import CoProducerHistory from '@/components/audiotool/coproducer/CoProducerHistory';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';

const sel = 'w-full h-9 rounded-md border border-input bg-popover px-3 text-sm';

export default function MidiCoProducerPanel({ nexus, projectUrl, version, onChanged }) {
  const [regions, setRegions] = useState(() => listNoteRegions(nexus));
  const [regionId, setRegionId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [placement, setPlacement] = useState('after');
  const [state, setState] = useState({ loading: false, error: '', done: '' });
  const [history, setHistory] = useState([]);
  const [undoing, setUndoing] = useState('');

  const reload = () => setRegions(listNoteRegions(nexus));
  // Regions added or removed in the DAW appear here as they sync.
  useEffect(() => { reload(); }, [nexus, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const region = regions.find((r) => r.id === regionId);

  const run = async () => {
    setState({ loading: true, error: '', done: '' });
    try {
      const text = prompt.trim();
      const notes = readNotes(nexus, region.entity);
      const length = region.entity.fields.region.fields.loopDurationTicks.value;
      const next = await transformNotes(notes, text, length);
      if (!next.length) throw new Error('The co-producer returned no usable notes — try rephrasing.');
      const ids = unwrap(await writeRegion(nexus, region.entity, next, `Co-Pro: ${text}`, placement));
      const log = await logInvocation(projectUrl, { tool: 'midi_coproducer', prompt: text, collectionIds: [ids.collectionId] });
      setHistory((h) => [{ ...ids, logId: log?.id, prompt: text, count: next.length, source: region.name }, ...h]);
      setState({ loading: false, error: '', done: `Wrote ${next.length} notes ${placement === 'layer' ? 'on a new layered track' : `right after "${region.name}"`}.` });
      reload();
      onChanged?.();
    } catch (e) {
      setState({ loading: false, error: e.message, done: '' });
    }
  };

  const undo = async (item) => {
    setUndoing(item.regionId);
    try {
      unwrap(await undoRegion(nexus, item));
      if (item.logId) await deleteInvocation(item.logId);
      setHistory((h) => h.filter((x) => x.regionId !== item.regionId));
      toast.success('Rewrite removed from your project');
      reload();
      onChanged?.();
    } catch (e) { toast.error(`Couldn't undo — ${e.message}`); }
    setUndoing('');
  };

  return (
    <section className="rack-unit !pt-8 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold flex items-center gap-2"><Wand2 className="w-4 h-4" /> Nexus Co-Producer <InfoTip text={TIPS.coProducer} size="sm" side="bottom" /></h3>
          <p className="text-sm text-muted-foreground">Pick a MIDI region, describe the change, and a new version lands on the timeline — undo it any time.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={reload}><RefreshCw className="w-3.5 h-3.5" /></Button>
      </div>
      {regions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No MIDI regions in this project yet — add one in Audiotool and it appears here automatically.</p>
      ) : (
        <>
          <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className={sel}>
            <option value="">Choose a MIDI region…</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name} — bar {r.bar}, {r.bars} bar(s)</option>)}
          </select>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setPrompt(p)}
                className={`rounded-full border px-3 py-1 text-xs ${prompt === p ? 'border-accent text-accent' : 'border-border text-muted-foreground'}`}>{p}</button>
            ))}
          </div>
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} placeholder="Make it a syncopated arpeggio up an octave" />
          <div className="flex items-center gap-2">
            <select value={placement} onChange={(e) => setPlacement(e.target.value)} className={sel} aria-label="Where the result goes">
              {PLACEMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <InfoTip text={TIPS.placement} size="sm" />
          </div>
          <Button className="merc-button" onClick={run} disabled={!region || !prompt.trim() || state.loading}>
            {state.loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
            Rework & write to timeline
          </Button>
        </>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.done && <p className="text-sm text-emerald-300">{state.done}</p>}
      <CoProducerHistory items={history} busyId={undoing} onUndo={undo} />
    </section>
  );
}