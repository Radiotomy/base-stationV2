import { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ScanSearch, Loader2, Lock, FileAudio } from 'lucide-react';
import { decodeFileToMono, detectMarkInSamples } from '@/utils/baseMarkDetector';
import PublicScanResult from '@/components/watermark/PublicScanResult';

export default function VerifyMark() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [result, setResult] = useState(null);
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState('');

  const scan = async () => {
    setBusy(true); setError(''); setResult(null); setMatches(null);
    try {
      setPhase('Decoding audio…');
      let samples;
      try {
        samples = await decodeFileToMono(file);
      } catch {
        throw new Error('Could not decode this audio file. Supported: WAV, MP3, OGG, M4A/MP4, WebM, FLAC.');
      }
      setPhase('Scanning waveform…');
      // Let the UI paint the phase label before the CPU-heavy scan
      await new Promise((r) => setTimeout(r, 50));
      const res = detectMarkInSamples(samples);
      setResult(res);
      if (res.detected && res.payload_hex) {
        const lookup = await base44.functions.invoke('lookupBaseMark', { payloadHex: res.payload_hex });
        setMatches(lookup.data?.matches || []);
      }
    } catch (e) {
      setError(e.message);
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
            Free, no account needed. Drop in any audio file — WAV, MP3, OGG, or M4A — and we scan its
            waveform for a BASE Mark, the inaudible provenance signature embedded in tracks made on BASE Station.
          </p>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="w-3 h-3" /> Scanning runs entirely in your browser — your file is never uploaded.
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
              onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); setMatches(null); setError(''); }}
            />
          </label>
          <Button onClick={scan} disabled={!file || busy} className="merc-button w-full">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
            {busy ? phase : 'Scan File'}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <PublicScanResult result={result} matches={matches} />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Want your own tracks protected? Every WAV master saved on BASE Station is marked automatically.{' '}
          <Link to="/docs" className="text-[#FFC98A] underline underline-offset-2">Read how BASE Mark works</Link>
        </p>
      </div>
    </div>
  );
}