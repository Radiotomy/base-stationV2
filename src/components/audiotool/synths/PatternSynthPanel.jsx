import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Piano, Send, Eraser } from 'lucide-react';
import { planSynth, buildSynth, emptySynth } from '@/lib/audiotool/synthPattern';
import { logInvocation } from '@/lib/audiotool/nexusTelemetry';
import { unwrap } from '@/lib/audiotool/nexusErrors';
import BasslineGrid from './BasslineGrid';
import TonematrixGrid from './TonematrixGrid';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';

const KINDS = { bassline: ['Bassline', 'e.g. squelchy acid line in A minor'], tonematrix: ['Tonematrix', 'e.g. twinkly arpeggio, slow rise'] };

export default function PatternSynthPanel({ nexus, projectUrl, connected, onChanged }) {
  const [kind, setKind] = useState('bassline');
  const [prompt, setPrompt] = useState('');
  const [synth, setSynth] = useState(() => emptySynth('bassline'));
  const [aiMade, setAiMade] = useState(false);
  const [busy, setBusy] = useState('');
  const reset = (k) => { setKind(k); setSynth(emptySynth(k)); setAiMade(false); };

  const generate = async () => {
    setBusy('gen');
    try { setSynth(await planSynth(kind, prompt.trim())); setAiMade(true); }
    catch (e) { toast.error(`Couldn't write a pattern — ${e.message}`); }
    setBusy('');
  };

  const send = async () => {
    setBusy('send');
    try {
      const id = unwrap(await buildSynth(nexus, synth));
      if (aiMade) await logInvocation(projectUrl, { tool: `${kind}_generator`, prompt, deviceIds: [id] });
      toast.success(`"${synth.name}" is on a new ${KINDS[kind][0]} in your project`);
      onChanged?.();
    } catch (e) { toast.error(`Audiotool rejected the ${KINDS[kind][0]} — ${e.message}`); }
    setBusy('');
  };

  return (
    <section className="rounded-2xl border border-border p-5 space-y-4">
      <div>
        <h3 className="font-bold flex items-center gap-2"><Piano className="w-4 h-4" /> Pattern Synths <InfoTip text={TIPS.synths} size="sm" side="bottom" /></h3>
        <p className="text-sm text-muted-foreground">Write a bassline or a Tonematrix melody, edit the grid, then drop it onto a new device in your project.</p>
      </div>
      <div className="flex gap-2">
        {Object.entries(KINDS).map(([k, [label]]) => (
          <Button key={k} size="sm" variant={kind === k ? 'default' : 'outline'} disabled={!!busy} onClick={() => reset(k)}>{label}</Button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={KINDS[kind][1]} />
        <Button className="merc-button" disabled={!prompt.trim() || !!busy} onClick={generate}>
          {busy === 'gen' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Piano className="w-4 h-4" />} Write pattern
        </Button>
      </div>
      {kind === 'bassline' ? <BasslineGrid synth={synth} onChange={setSynth} /> : <TonematrixGrid synth={synth} onChange={setSynth} />}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!!busy || !connected} onClick={send}>
          {busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send to Audiotool
        </Button>
        <Button variant="outline" disabled={!!busy} onClick={() => reset(kind)}><Eraser className="w-4 h-4" /> Clear</Button>
      </div>
    </section>
  );
}