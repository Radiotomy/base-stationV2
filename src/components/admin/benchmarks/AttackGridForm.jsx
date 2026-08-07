import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Swords } from 'lucide-react';

const CODECS = ['none', 'mp3_320', 'mp3_192', 'mp3_128', 'aac_128', 'opus_128'];

export default function AttackGridForm({ onStarted }) {
  const { toast } = useToast();
  const [markedUrl, setMarkedUrl] = useState('');
  const [runId, setRunId] = useState('');
  const [attacks, setAttacks] = useState('');
  const [payload, setPayload] = useState('beefcafe');
  const [codec, setCodec] = useState('none');
  const [batchSize, setBatchSize] = useState(4);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (!markedUrl.trim() || !runId.trim()) {
      toast({ title: 'Need a run id and a marked file URL', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const list = attacks.split(',').map((a) => a.trim()).filter(Boolean);
      const res = await base44.functions.smokeBaseMarkV4({
        action: 'grid',
        marked_url: markedUrl.trim(),
        attacks: list,
        codec,
        batch_size: Number(batchSize),
      });
      const data = res.data || res;
      if (data.error) throw new Error(`${data.error}${data.available ? ` — available: ${data.available.join(', ')}` : ''}`);
      await base44.entities.BaseMarkRun.create({
        run_id: runId.trim(),
        kind: 'attack_grid',
        layer: 'speed',
        status: 'running',
        params: { codec, payload_hex: payload, marked_url: markedUrl.trim(), remaining: data.remaining || [] },
        jobs: data.jobs || [],
      });
      toast({
        title: `Dispatched ${data.started} attack${data.started === 1 ? '' : 's'}`,
        description: data.remaining?.length ? `${data.remaining.length} left for the next batch` : 'Poll from the monitor below.',
      });
      onStarted?.();
    } catch (e) {
      toast({ title: 'Could not start grid', description: e.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <div className="merc-card rounded-xl p-5 space-y-3">
      <div>
        <p className="font-bold text-foreground text-sm">Attack grid — marked audio</p>
        <p className="text-xs text-muted-foreground">
          Applies attacks to one already-marked file and decodes each result. Batched deliberately: attacks are
          applied on full-length audio, so a whole grid in one request would die mid-way and leave you unable to
          tell which attacks actually ran.
        </p>
      </div>
      <Input value={markedUrl} onChange={(e) => setMarkedUrl(e.target.value)} placeholder="Marked file URL" className="text-xs font-mono" />
      <div className="grid sm:grid-cols-2 gap-2">
        <Input value={runId} onChange={(e) => setRunId(e.target.value)} placeholder="run id" className="text-xs" />
        <Input value={payload} onChange={(e) => setPayload(e.target.value)} placeholder="expected payload hex" className="text-xs" />
        <Select value={codec} onValueChange={setCodec}>
          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{CODECS.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="number" min={1} max={6} value={batchSize} onChange={(e) => setBatchSize(e.target.value)} placeholder="batch size" className="text-xs" />
      </div>
      <Input value={attacks} onChange={(e) => setAttacks(e.target.value)} placeholder="Attack ids, comma separated — leave blank for the whole registry" className="text-xs font-mono" />
      <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">
        control · pitch_up_1 · pitch_down_1 · pitch_up_2 · pitch_up_113c · pitch_up_37c · pitch_up_5c · pitch_up_2c ·
        resample_48_441 · stretch_105 · stretch_095 · lowpass_15k · lowpass_11k · bitcrush_8 · noise_20db · noise_10db ·
        crop_5s · crop_3s · crop_2s
      </p>
      <Button onClick={start} disabled={busy} className="merc-button rounded-xl w-full gap-2">
        <Swords className="w-4 h-4" /> {busy ? 'Dispatching…' : 'Start attack batch'}
      </Button>
    </div>
  );
}