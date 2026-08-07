import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Play } from 'lucide-react';

const CLASSES = ['human_lossless', 'ai_generated_wav', 'ai_generated_codec', 'human_lossy_preview', 'synthetic_tone'];
const CODECS = ['none', 'mp3_320', 'mp3_192', 'mp3_128', 'aac_128', 'opus_128'];

export default function NullScanForm({ onStarted }) {
  const { toast } = useToast();
  const [urls, setUrls] = useState('');
  const [runId, setRunId] = useState('');
  const [sourceClass, setSourceClass] = useState('human_lossless');
  const [codec, setCodec] = useState('none');
  const [seconds, setSeconds] = useState(60);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const start = async () => {
    const sources = urls.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!sources.length || !runId.trim()) {
      toast({ title: 'Need a run id and at least one source URL', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const res = await base44.functions.smokeBaseMarkV4({
        action: 'null_scan',
        sources,
        source_class: sourceClass,
        codec,
        seconds: Number(seconds),
        batch_size: Math.min(6, sources.length),
        range_bytes: 12000000,
      });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      await base44.entities.BaseMarkRun.create({
        run_id: runId.trim(),
        kind: 'null_scan',
        layer: 'speed',
        status: 'running',
        params: { source_class: sourceClass, codec, seconds: Number(seconds) },
        jobs: data.jobs || [],
        notes: notes || undefined,
      });
      toast({
        title: `Dispatched ${data.started} scan${data.started === 1 ? '' : 's'}`,
        description: data.rejected ? `${data.rejected} rejected by the ${seconds}s duration gate` : 'Poll from the monitor below.',
      });
      setUrls('');
      onStarted?.();
    } catch (e) {
      toast({ title: 'Could not start scan', description: e.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <div className="merc-card rounded-xl p-5 space-y-3">
      <div>
        <p className="font-bold text-foreground text-sm">Null scan — unmarked audio</p>
        <p className="text-xs text-muted-foreground">
          Measures false positives. Speed search is forced on, since that is the path most likely to
          hallucinate a pattern line. Anything under the duration gate is rejected rather than scanned short.
        </p>
      </div>
      <Textarea
        rows={5}
        value={urls}
        onChange={(e) => setUrls(e.target.value)}
        placeholder="One audio URL per line (max 6 per batch)"
        className="text-xs font-mono"
      />
      <div className="grid sm:grid-cols-2 gap-2">
        <Input value={runId} onChange={(e) => setRunId(e.target.value)} placeholder="run id, e.g. null-classical-2026-08-07" className="text-xs" />
        <Input type="number" value={seconds} onChange={(e) => setSeconds(e.target.value)} placeholder="seconds" className="text-xs" />
        <Select value={sourceClass} onValueChange={setSourceClass}>
          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{CLASSES.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={codec} onValueChange={setCodec}>
          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{CODECS.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes — what this material is, and any caveat" className="text-xs" />
      <Button onClick={start} disabled={busy} className="merc-button rounded-xl w-full gap-2">
        <Play className="w-4 h-4" /> {busy ? 'Dispatching…' : 'Start null scan'}
      </Button>
    </div>
  );
}