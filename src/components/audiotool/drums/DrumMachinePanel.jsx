import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Drum, Send, Eraser } from 'lucide-react';
import { planDrums, buildDrums, emptyPattern } from '@/lib/audiotool/drumPattern';
import { logInvocation } from '@/lib/audiotool/nexusTelemetry';
import { unwrap } from '@/lib/audiotool/nexusErrors';
import DrumStepGrid from './DrumStepGrid';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';
import RackUnit from '@/components/audiotool/mercury/RackUnit';

export default function DrumMachinePanel({ nexus, projectUrl, connected, onChanged }) {
  const [prompt, setPrompt] = useState('');
  const [steps, setSteps] = useState(16);
  const [pattern, setPattern] = useState(() => emptyPattern(16));
  const [aiMade, setAiMade] = useState(false);
  const [busy, setBusy] = useState('');

  const generate = async () => {
    setBusy('gen');
    try { setPattern(await planDrums(prompt.trim(), steps)); setAiMade(true); }
    catch (e) { toast.error(`Couldn't write a beat — ${e.message}`); }
    setBusy('');
  };

  const toggle = (row, i) => setPattern((p) => row === 'accents'
    ? { ...p, accents: p.accents.map((v, j) => (j === i ? !v : v)) }
    : { ...p, rows: { ...p.rows, [row]: p.rows[row].map((v, j) => (j === i ? !v : v)) } });

  const send = async () => {
    setBusy('send');
    try {
      const id = unwrap(await buildDrums(nexus, pattern));
      if (aiMade) await logInvocation(projectUrl, { tool: 'drum_generator', prompt, deviceIds: [id] });
      toast.success(`"${pattern.name}" is on a new Beatbox 8 in your project`);
      onChanged?.();
    } catch (e) { toast.error(`Audiotool rejected the drum machine — ${e.message}`); }
    setBusy('');
  };

  return (
    <RackUnit icon={Drum} title="Drum Machine" status={`${steps} steps · ${connected ? 'linked' : 'offline'}`} live={connected}
      extra={<InfoTip text={TIPS.drums} size="sm" side="bottom" />}
      description="Describe a beat or tap it in, tweak the steps, then drop it onto a Beatbox 8 in your project.">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. laid-back boom bap with swung hats" />
        <select value={steps} onChange={(e) => { const n = Number(e.target.value); setSteps(n); setPattern(emptyPattern(n)); setAiMade(false); }}
          className="h-9 rounded-md border border-input bg-popover px-2 text-sm" aria-label="Pattern length">
          <option value={16}>1 bar</option><option value={32}>2 bars</option>
        </select>
        <InfoTip text={TIPS.drumLength} size="sm" className="self-center" />
        <Button className="merc-button" disabled={!prompt.trim() || !!busy} onClick={generate}>
          {busy === 'gen' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Drum className="w-4 h-4" />} Write beat
        </Button>
      </div>
      <DrumStepGrid pattern={pattern} onToggle={toggle} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={!!busy || !connected} onClick={send}>
          {busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send to Audiotool
        </Button>
        <Button variant="outline" disabled={!!busy} onClick={() => { setPattern(emptyPattern(steps)); setAiMade(false); }}>
          <Eraser className="w-4 h-4" /> Clear
        </Button>
      </div>
    </RackUnit>
  );
}