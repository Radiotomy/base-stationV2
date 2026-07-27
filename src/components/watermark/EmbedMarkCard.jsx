import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Fingerprint, Loader2, Download, CheckCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AUDIO_TYPES = ['track', 'master', 'stem', 'mashup', 'harmony', 'sfx'];

export default function EmbedMarkCard() {
  const [assets, setAssets] = useState([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const user = await base44.auth.me();
      const rows = await base44.entities.UserAsset.filter({ user_id: user.id }, '-created_date', 200);
      setAssets(rows.filter((a) => AUDIO_TYPES.includes(a.asset_type)));
    })();
  }, []);

  const embed = async () => {
    setBusy(true); setError(''); setResult(null);
    try {
      const res = await base44.functions.invoke('applyBaseMark', { assetId: selected });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
    setBusy(false);
  };

  return (
    <div className="merc-card rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Fingerprint className="w-5 h-5 text-[#FF9A4D]" />
        <h2 className="font-display text-lg">BASE Mark — Spectral Layer</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Pick a track from your library. We embed an inaudible 32-bit signature directly into the audio
        waveform, instantly — it survives cutting, sampling and remixing, even if all metadata is stripped.
        This is one of the two layers that make up your track's full BASE Mark; the neural layer runs
        alongside it automatically. Requires WAV audio (16-bit or 24-bit PCM).
      </p>
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger><SelectValue placeholder="Choose a library track…" /></SelectTrigger>
        <SelectContent>
          {assets.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.title} · {a.asset_type}{a.metadata?.base_mark ? ' · ✓ marked' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={embed} disabled={!selected || busy} className="merc-button w-full">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
        {busy ? 'Embedding…' : 'Embed Spectral Layer'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2 text-sm">
          <p className="flex items-center gap-2 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" /> Spectral layer embedded
          </p>
          <p>Payload: <code className="text-[#FFC98A]">{result.payload_hex}</code></p>
          <a href={result.marked_file_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[#FFC98A] hover:underline">
            <Download className="w-4 h-4" /> Download watermarked WAV
          </a>
        </div>
      )}
    </div>
  );
}