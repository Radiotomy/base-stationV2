import { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ScanSearch, Loader2, Lock, FileAudio } from 'lucide-react';
import { fileToVerifySnippetB64 } from '@/utils/verifyAudioClip';
import PublicScanResult from '@/components/watermark/PublicScanResult';

export default function VerifyMark() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const scan = async () => {
    setBusy(true); setError(''); setResult(null);
    try {
      setPhase('Preparing audio…');
      let b64;
      try {
        b64 = await fileToVerifySnippetB64(file);
      } catch {
        throw new Error('Could not decode this audio file. Supported: WAV, MP3, OGG, M4A/MP4, WebM, FLAC.');
      }
      setPhase('Verifying…');
      const res = await base44.functions.invoke('verifyBaseMark', { fileB64: b64 });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
    setBusy(false);
    setPhase('');
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="text-center space-y-3">
          <h1 className="font-display text-3xl text-iridescent">Verify a BASE Mark</h1>
          <p className="text-muted-foreground text-sm">
            Free, no account needed. Drop in any audio file — WAV, MP3, OGG, M4A, WebM, or FLAC — and we scan its
            waveform for a BASE Mark, the inaudible provenance signature embedded in tracks made on BASE Station.
          </p>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="w-3 h-3" /> Only a short audio snippet is analyzed on our secure servers. The acoustic scan runs in memory; signed-in creators also get a neural scan (snippet uploaded for that run only).
          </p>
        </div>

        <div className="merc-card rounded-2xl p-6 space-y-4">
          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-[#FF9A4D]/50 transition-colors p-8 cursor-pointer">
            <FileAudio className="w-8 h-8 text-[#FF9A4D]" />
            <span className="text-sm text-foreground font-medium">{file ? file.name : 'Choose an audio file'}</span>
            <span className="text-xs text-muted-foreground">WAV · MP3 · OGG · M4A/MP4 · WebM · FLAC</span>
            <input
              type="file" accept=".wav,.mp3,.ogg,.oga,.m4a,.mp4,.aac,.webm,.flac,audio/*"
              className="hidden"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); setError(''); }}
            />
          </label>
          <Button onClick={scan} disabled={!file || busy} className="merc-button w-full">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
            {busy ? phase : 'Scan File'}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <PublicScanResult result={result} matches={result?.matches ?? null} />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Want your own tracks protected? Every audio master (WAV or FLAC) saved on BASE Station is marked
          automatically, and the payload is threaded through its Provenance Manifest, DDEX bundle, and on-chain record.{' '}
          <Link to="/docs?section=base-mark" className="text-[#FFC98A] underline underline-offset-2">Read how BASE Mark works</Link>
        </p>
        <p className="text-center text-[11px] text-muted-foreground/70">
          BASE Mark runs two live layers: V1 acoustic (applied automatically to every saved master) and V2 neural
          (built to survive heavy compression and pitch/time attacks). This public scan checks the acoustic layer
          first; signed-in creators also get a neural fallback scan; a clean scan is not proof a file was never marked.
        </p>
      </div>
    </div>
  );
}