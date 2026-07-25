import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { BrainCircuit, Loader2, Download, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AUDIO_TYPES = ['track', 'master', 'stem', 'mashup', 'harmony', 'sfx'];

// Neural (SilentCipher) watermark via the BASE Mark V2 Replicate model.
// The embed runs asynchronously — fires the prediction, then polls every
// few seconds until the marked WAV is persisted. A cold T4 instance can
// take 2–5 minutes on the first run; the progress bar reflects that window.
export default function EmbedMarkV2Card() {
  const [assets, setAssets] = useState([]);
  const [selected, setSelected] = useState('');
  const [starting, setStarting] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | processing | done | failed
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        const rows = await base44.entities.UserAsset.filter({ user_id: user.id }, '-created_date', 200);
        setAssets(rows.filter((a) => AUDIO_TYPES.includes(a.asset_type)));
      } catch { /* ignore — re-renders show empty list */ }
    })();
  }, []);

  useEffect(() => {
    if (phase !== 'processing') return;
    let stop = false;
    let timer;
    let elapsed = 0;
    const tick = async () => {
      try {
        const res = await base44.functions.invoke('pollBaseMarkV2', { assetId: selected });
        if (stop) return;
        const d = res.data;
        elapsed += 5;
        // Cold start window ~90s; cap visual progress at 95% until settled.
        setProgress(Math.min(95, Math.round((elapsed / 90) * 100)));
        if (d.status === 'completed') {
          setPhase('done'); setResult(d); setProgress(100);
          return;
        }
        if (d.status === 'failed') {
          setPhase('failed'); setError(d.error || 'Watermarking failed');
          return;
        }
        timer = setTimeout(tick, 5000);
      } catch (e) {
        if (stop) return;
        setError(e.response?.data?.error || e.message);
        setPhase('failed');
      }
    };
    timer = setTimeout(tick, 4000);
    return () => { stop = true; clearTimeout(timer); };
  }, [phase, selected]);

  const embed = async () => {
    setStarting(true); setError(''); setResult(null); setPhase('idle'); setProgress(0);
    try {
      const res = await base44.functions.invoke('embedBaseMarkV2', { assetId: selected });
      const d = res.data;
      if (d?.ok && d.status === 'processing') {
        setPhase('processing');
      } else if (d?.ok) {
        setResult(d); setPhase('done'); setProgress(100);
      } else {
        setError(d?.error || 'Failed to start'); setPhase('failed');
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message); setPhase('failed');
    }
    setStarting(false);
  };

  const busy = starting || phase === 'processing';

  return (
    <div className="merc-card rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <BrainCircuit className="w-5 h-5 text-[#FF9A4D]" />
        <h2 className="font-display text-lg">Embed a BASE Mark V2 (Neural)</h2>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#FF9A4D]/30 bg-[#FF9A4D]/10 px-2.5 py-0.5 text-[11px] text-[#FFC98A]">
          New
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        Embeds a learned, neural watermark that survives aggressive compression, pitch-shifting and
        time-stretching. Runs on a GPU — the first run after idle may take a few minutes to cold-start.
      </p>
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger><SelectValue placeholder="Choose a library track…" /></SelectTrigger>
        <SelectContent>
          {assets.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.title} · {a.asset_type}{a.metadata?.base_mark_v2?.status === 'completed' ? ' · ✓ neural-marked' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={embed} disabled={!selected || busy} className="merc-button w-full">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
        {starting ? 'Starting…' : phase === 'processing' ? 'Watermarking on GPU…' : 'Embed Neural Mark'}
      </Button>

      {phase === 'processing' && (
        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/40">
            <div className="h-full rounded-full bg-gradient-to-r from-[#FFC26E] to-[#FF6B4A] transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" /> {progress < 90
              ? 'Booting the GPU model & embedding… this can take a couple of minutes on a cold start.'
              : 'Finishing up — persisting the watermarked audio.'}
          </p>
        </div>
      )}

      {error && phase === 'failed' && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <XCircle className="w-4 h-4" /> {error}
        </p>
      )}

      {phase === 'done' && result && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2 text-sm">
          <p className="flex items-center gap-2 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" /> Neural watermark embedded
          </p>
          {result.payload_hex && <p>Payload: <code className="text-[#FFC98A]">{result.payload_hex}</code></p>}
          {result.marked_file_url && (
            <a href={result.marked_file_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[#FFC98A] hover:underline">
              <Download className="w-4 h-4" /> Download watermarked WAV
            </a>
          )}
        </div>
      )}
    </div>
  );
}