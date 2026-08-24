import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FileJson, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { buildManifest, manifestReadiness } from '@/lib/substation/manifest';
import { downloadBlob } from '@/lib/substation/wav';

// Bounces the arrangement offline, then hands the master, the stems and the COS
// manifest to the creator. Rendering is offline so the bounce is faster than
// real time and never depends on playback being running.
export default function ExportModal({ open, onOpenChange, engine, session }) {
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const checks = manifestReadiness(session);
  const ready = checks.every(c => c.ok);

  const render = async () => {
    setBusy('Rendering master and stems…');
    setError('');
    try {
      const out = await engine.bounce(session, { stems: true });
      setResult(out);
    } catch (e) {
      setError(e.message || 'Render failed.');
    }
    setBusy('');
  };

  const saveManifest = async () => {
    let me = null;
    try { me = await base44.auth.me(); } catch { /* manifest still valid without owner block */ }
    const manifest = buildManifest(session, me);
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${(session.meta.title || session.name).replace(/\s+/g, '_')}_cos_manifest.json`);
  };

  const base = (session.meta.title || session.name).replace(/\s+/g, '_');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#09090b] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono uppercase tracking-widest text-[#14b8a6]">
            Master Export
          </DialogTitle>
        </DialogHeader>

        {!ready && (
          <div className="rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/8 p-2.5 flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b] shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] text-[#f59e0b] font-semibold">Manifest incomplete</p>
              <p className="text-[10px] text-white/50 leading-snug mt-0.5">
                You can still bounce audio, but the COS manifest needs: {checks.filter(c => !c.ok).map(c => c.label).join('; ')}.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Button onClick={render} disabled={!!busy}
            className="w-full h-9 text-xs font-bold"
            style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#04211d' }}>
            {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
            {busy || 'Bounce master + stems'}
          </Button>

          {error && <p className="text-[11px] text-[#fb7185]">{error}</p>}

          {result && (
            <div className="rounded-lg border border-white/10 bg-black/30 p-2 space-y-1.5">
              <button onClick={() => downloadBlob(result.master, `${base}_master.wav`)}
                className="w-full flex items-center gap-2 text-[11px] text-white/80 hover:text-[#14b8a6]">
                <Download className="w-3 h-3" /> {base}_master.wav
              </button>
              {result.stems.map((s, i) => (
                <button key={i} onClick={() => downloadBlob(s.blob, `${base}_${s.name.replace(/\s+/g, '_')}.wav`)}
                  className="w-full flex items-center gap-2 text-[11px] text-white/60 hover:text-[#14b8a6]">
                  <Download className="w-3 h-3" /> stem · {s.name}
                </button>
              ))}
            </div>
          )}

          <Button onClick={saveManifest} variant="outline" className="w-full h-9 text-xs border-white/12 text-white/70">
            <FileJson className="w-3.5 h-3.5 mr-1.5" />
            Download COS manifest (JSON)
          </Button>
        </div>

        <p className="text-[10px] text-white/35 leading-snug">
          Bounces render through the same EQ, compressor and limiter you hear. Nothing is written to your
          BASE Station library from here — the manifest is what carries splits and metadata into COS.
        </p>
      </DialogContent>
    </Dialog>
  );
}