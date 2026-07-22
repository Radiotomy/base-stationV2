import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ScanSearch, Loader2, ShieldCheck, ShieldX } from 'lucide-react';

export default function DetectMarkCard() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const scan = async () => {
    setBusy(true); setError(''); setResult(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('detectBaseMark', { fileUrl: file_url });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
    setBusy(false);
  };

  return (
    <div className="merc-card rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ScanSearch className="w-5 h-5 text-[#FF9A4D]" />
        <h2 className="font-display text-lg">Scan for a BASE Mark</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Upload any WAV file — a remix, stem cut, or sample — and we scan the waveform for an embedded
        BASE Mark. If found, we trace it back to the original track in our registry.
      </p>
      <input
        type="file" accept=".wav,audio/wav,audio/x-wav"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-foreground"
      />
      <Button onClick={scan} disabled={!file || busy} className="merc-button w-full">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
        {busy ? 'Scanning waveform…' : 'Scan File'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <div className={`rounded-xl border p-4 space-y-2 text-sm ${result.detected ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-border bg-secondary/40'}`}>
          {result.detected ? (
            <>
              <p className="flex items-center gap-2 text-emerald-400 font-semibold">
                <ShieldCheck className="w-4 h-4" /> BASE Mark detected
              </p>
              <p>Payload: <code className="text-[#FFC98A]">{result.payload_hex}</code></p>
              <p className="text-muted-foreground">
                Signal strength {Math.round(result.mean_strength * 1000) / 10}‰ · block agreement {Math.round(result.agreement * 100)}% · {result.blocks_scanned} blocks scanned
              </p>
              {result.matches?.length > 0 ? (
                <div className="pt-1">
                  <p className="font-semibold text-foreground">Traced to:</p>
                  {result.matches.map((m) => (
                    <p key={m.id} className="text-muted-foreground">
                      🎵 {m.title} <span className="text-xs">({m.asset_type}, marked {new Date(m.marked_at || m.created_date).toLocaleDateString()})</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No matching track found in the registry for this payload.</p>
              )}
            </>
          ) : (
            <p className="flex items-center gap-2 text-muted-foreground">
              <ShieldX className="w-4 h-4" /> No BASE Mark found in this file.{result.reason ? ` ${result.reason}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}