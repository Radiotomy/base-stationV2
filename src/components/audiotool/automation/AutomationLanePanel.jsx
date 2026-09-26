import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Activity, Send } from 'lucide-react';
import { listDevices, listFields } from '@/lib/audiotool/deviceParams';
import { SHAPES, planCurve, writeAutomation } from '@/lib/audiotool/automationLane';
import { logInvocation } from '@/lib/audiotool/nexusTelemetry';
import { unwrap } from '@/lib/audiotool/nexusErrors';
import CurvePreview from './CurvePreview';

const sel = 'w-full h-9 rounded-md border border-input bg-popover px-2 text-sm';

export default function AutomationLanePanel({ nexus, projectUrl, version, connected, onChanged }) {
  const devices = useMemo(() => listDevices(nexus), [nexus, version]);
  const [deviceId, setDeviceId] = useState('');
  const [field, setField] = useState('');
  const [shape, setShape] = useState('rise');
  const [prompt, setPrompt] = useState('');
  const [bars, setBars] = useState(4);
  const [startBar, setStartBar] = useState(1);
  const [values, setValues] = useState(null);
  const [busy, setBusy] = useState('');
  const device = devices.find((d) => d.id === deviceId);
  const fields = useMemo(() => (device ? listFields(device.entity).filter((f) => f.kind === 'number') : []), [device]);

  // Preset shapes preview instantly; AI curves wait for "Draw curve".
  useEffect(() => { if (shape !== 'ai') planCurve(shape, bars).then(setValues); else setValues(null); }, [shape, bars]);

  const drawAi = async () => {
    setBusy('gen');
    try { setValues(await planCurve('ai', bars, prompt.trim())); } catch (e) { toast.error(e.message); }
    setBusy('');
  };

  const send = async () => {
    setBusy('send');
    try {
      const label = `${device.name} · ${field.split('.').pop()}`;
      const id = unwrap(await writeAutomation(nexus, { device, fieldPath: field, startBar, bars, values, label }));
      if (shape === 'ai') await logInvocation(projectUrl, { tool: 'automation_generator', prompt, collectionIds: [id] });
      toast.success(`Automation lane written at bar ${startBar}`);
      onChanged?.();
    } catch (e) { toast.error(`Audiotool rejected the automation — ${e.message}`); }
    setBusy('');
  };

  return (
    <section className="rounded-2xl border border-border p-5 space-y-4">
      <div>
        <h3 className="font-bold flex items-center gap-2"><Activity className="w-4 h-4" /> Automation Lanes</h3>
        <p className="text-sm text-muted-foreground">Pick a device knob, draw a movement, and it lands as an automation region on the timeline.</p>
      </div>
      {devices.length === 0 ? <p className="text-sm text-muted-foreground">No devices in this project yet.</p> : (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Device</Label>
              <select className={sel} value={deviceId} onChange={(e) => { setDeviceId(e.target.value); setField(''); }}>
                <option value="">Choose a device…</option>
                {devices.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.type})</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>Parameter</Label>
              <select className={sel} value={field} disabled={!device} onChange={(e) => setField(e.target.value)}>
                <option value="">Choose a parameter…</option>
                {fields.map((f) => <option key={f.path} value={f.path}>{f.path}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>Shape</Label>
              <select className={sel} value={shape} onChange={(e) => setShape(e.target.value)}>
                {SHAPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Start bar</Label><Input type="number" min="1" value={startBar} onChange={(e) => setStartBar(Math.max(1, Number(e.target.value) || 1))} /></div>
              <div className="space-y-1"><Label>Length</Label>
                <select className={sel} value={bars} onChange={(e) => setBars(Number(e.target.value))}>
                  {[1, 2, 4, 8].map((b) => <option key={b} value={b}>{b} bar{b > 1 ? 's' : ''}</option>)}
                </select>
              </div>
            </div>
          </div>
          {shape === 'ai' && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. slow filter sweep that snaps shut on the last beat" />
              <Button className="merc-button" disabled={!prompt.trim() || !!busy} onClick={drawAi}>
                {busy === 'gen' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />} Draw curve
              </Button>
            </div>
          )}
          <CurvePreview values={values} />
          <Button disabled={!device || !field || !values || !!busy || !connected} onClick={send}>
            {busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Write to timeline
          </Button>
        </>
      )}
    </section>
  );
}