import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wand2, RefreshCw } from 'lucide-react';
import { listNoteRegions, readNotes, transformNotes, writeRegion } from '@/lib/audiotool/midiCoProducer';
import { logInvocation } from '@/lib/audiotool/nexusTelemetry';

export default function MidiCoProducerPanel({ nexus, projectUrl, version, onChanged }) {
  const [regions, setRegions] = useState(() => listNoteRegions(nexus));
  const [regionId, setRegionId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [state, setState] = useState({ loading: false, error: '', done: '' });

  const reload = () => setRegions(listNoteRegions(nexus));
  // Regions added or removed in the DAW appear here as they sync.
  useEffect(() => { reload(); }, [nexus, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const region = regions.find((r) => r.id === regionId);

  const run = async () => {
    setState({ loading: true, error: '', done: '' });
    try {
      const notes = readNotes(nexus, region.entity);
      const length = region.entity.fields.region.fields.loopDurationTicks.value;
      const next = await transformNotes(notes, prompt.trim(), length);
      if (!next.length) throw new Error('The co-producer returned no usable notes — try rephrasing.');
      const collectionId = await writeRegion(nexus, region.entity, next, `Co-Pro: ${prompt.trim()}`);
      await logInvocation(projectUrl, { tool: 'midi_coproducer', prompt: prompt.trim(), collectionIds: [collectionId] });
      setState({ loading: false, error: '', done: `Wrote ${next.length} notes right after "${region.name}".` });
      reload();
      onChanged?.();
    } catch (e) {
      setState({ loading: false, error: e.message, done: '' });
    }
  };

  return (
    <section className="rounded-2xl border border-border p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold flex items-center gap-2"><Wand2 className="w-4 h-4" /> Nexus Co-Producer</h3>
          <p className="text-sm text-muted-foreground">Pick a MIDI region, describe the change, and a new version lands on the same track.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={reload}><RefreshCw className="w-3.5 h-3.5" /></Button>
      </div>
      {regions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No MIDI regions in this project yet — add one in Audiotool and it appears here automatically.</p>
      ) : (
        <>
          <select value={regionId} onChange={(e) => setRegionId(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-popover px-3 text-sm">
            <option value="">Choose a MIDI region…</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name} — bar {r.bar}, {r.bars} bar(s)</option>)}
          </select>
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2}
            placeholder="Make it a syncopated arpeggio up an octave" />
          <Button className="merc-button" onClick={run} disabled={!region || !prompt.trim() || state.loading}>
            {state.loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
            Rework & write to timeline
          </Button>
        </>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.done && <p className="text-sm text-emerald-300">{state.done}</p>}
    </section>
  );
}