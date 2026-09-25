import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Cable } from 'lucide-react';
import { planChain, buildChain } from '@/lib/audiotool/instrumentChain';
import { logInvocation } from '@/lib/audiotool/nexusTelemetry';

export default function InstrumentChainPanel({ at, nexus, projectUrl, onChanged }) {
  const [prompt, setPrompt] = useState('');
  const [state, setState] = useState({ loading: false, error: '', result: null });

  const run = async () => {
    setState({ loading: true, error: '', result: null });
    try {
      const plan = await planChain(prompt.trim());
      const { devices, deviceIds } = await buildChain(at, nexus, plan);
      await logInvocation(projectUrl, { tool: 'instrument_chain', prompt: prompt.trim(), deviceIds });
      setState({ loading: false, error: '', result: { name: plan.name, devices } });
      onChanged?.();
    } catch (e) {
      setState({ loading: false, error: e.message, result: null });
    }
  };

  return (
    <section className="rounded-2xl border border-border p-5 space-y-3">
      <div>
        <h3 className="font-bold flex items-center gap-2"><Cable className="w-4 h-4" /> Generate Instrument Chain</h3>
        <p className="text-sm text-muted-foreground">
          Describe a sound. We match community presets and wire synth → effects → a new mixer channel in your session.
        </p>
      </div>
      <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2}
        placeholder="Dusty lo-fi Rhodes with tape wobble and a long plate reverb" />
      <Button className="merc-button" onClick={run} disabled={!prompt.trim() || state.loading}>
        {state.loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Cable className="w-4 h-4 mr-2" />}
        Build chain in Audiotool
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.result && (
        <div className="space-y-1.5">
          <p className="text-sm text-emerald-300">"{state.result.name}" added — check your Audiotool desktop.</p>
          <div className="flex flex-wrap gap-1.5">
            {state.result.devices.map((d, i) => (
              <Badge key={i} variant="secondary">{d.device}{d.preset ? ` · ${d.preset}` : ' · default'}</Badge>
            ))}
            <Badge variant="outline">mixer channel</Badge>
          </div>
        </div>
      )}
    </section>
  );
}