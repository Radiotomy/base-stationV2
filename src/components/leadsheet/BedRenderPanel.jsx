import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Guitar, Loader2, Download, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { sendAssetToSubStation } from '@/lib/substation/handoff';
import { pollJob } from '@/lib/polling/pollJob';
import BedLicenseNotice from '@/components/leadsheet/BedLicenseNotice';

/**
 * Instrumental bed from the authored chord chart.
 *
 * Saves the score first (via the page's own save) because the engine reads the
 * progression from the stored lead sheet — the same discipline the vocal render uses.
 */
export default function BedRenderPanel({ chords, onSaveScore }) {
  const navigate = useNavigate();
  const [style, setStyle] = useState('');
  const [seconds, setSeconds] = useState(30);
  const [running, setRunning] = useState(false);
  const [asset, setAsset] = useState(null);
  const watchRef = useRef(null);

  useEffect(() => () => watchRef.current?.cancel(), []);

  // Cadence renders one bed at a time, so cadence and deadline come from the
  // shared 'engine' polling policy rather than a flat 5s loop of our own.
  const poll = (jobId) => {
    watchRef.current = pollJob(
      async () => (await base44.functions.invoke('pollMusicGenChordBed', { job_id: jobId })).data || {},
      'engine',
    );
    watchRef.current.promise.then(({ outcome, data, error }) => {
      setRunning(false);
      if (outcome === 'completed') {
        setAsset(data.asset);
        toast.success('Instrumental bed ready', { icon: '🎸' });
      } else if (outcome === 'failed') {
        toast.error(error || 'Bed render failed');
      } else {
        toast.error('The bed is taking longer than expected — it will land in your library when it finishes.');
      }
    });
  };

  const render = async () => {
    if (!chords.trim()) { toast.error('Write a chord chart first'); return; }
    if (!style.trim()) { toast.error('Describe the instrumentation'); return; }

    const saved = await onSaveScore();
    if (!saved) return;

    setRunning(true);
    setAsset(null);
    try {
      const r = await base44.functions.invoke('generateBedMusicGenChord', {
        leadSheetId: saved.id, style, duration: seconds,
      });
      const jobId = r.data?.job_id;
      if (!jobId) {
        setRunning(false);
        toast.error('The engine did not start a render — nothing was charged.');
        return;
      }
      toast.success('Bed render started.');
      poll(jobId);
    } catch (e) {
      setRunning(false);
      toast.error(e?.response?.data?.error || 'Could not start the bed render');
    }
  };

  const toSubStation = () => {
    sendAssetToSubStation(asset);
    navigate('/sub-station');
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Guitar className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-black">Instrumental Bed</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Plays your exact progression. Describe the instruments and feel — leave the
        chords out of it, they come from your chart.
      </p>

      <Input
        value={style}
        onChange={(e) => setStyle(e.target.value)}
        placeholder="warm fingerpicked acoustic guitar, soft upright bass"
        className="rounded-lg text-sm"
      />

      <div>
        <label className="text-[11px] font-bold text-muted-foreground">
          Length — {seconds}s
        </label>
        <input
          type="range" min={8} max={120} step={2} value={seconds}
          onChange={(e) => setSeconds(Number(e.target.value))}
          className="w-full mt-1"
        />
      </div>

      <Button onClick={render} disabled={running}
        className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 gap-2 font-bold">
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Guitar className="w-4 h-4" />}
        {running ? 'Rendering bed…' : 'Play My Chords'}
      </Button>
      <p className="text-[11px] text-muted-foreground text-center">
        Free — Cadence beds are for drafting and personal use only (non-commercial
        model weights). It renders one bed at a time, so a busy queue means a longer
        wait rather than a failure.
      </p>

      {asset && (
        <div className="space-y-3 pt-1">
          <audio src={asset.file_url} controls className="w-full" />
          <BedLicenseNotice />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild className="rounded-xl gap-2 text-xs font-bold">
              <a href={asset.file_url} download>
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            </Button>
            <Button variant="outline" onClick={toSubStation} className="rounded-xl gap-2 text-xs font-bold">
              <Sliders className="w-3.5 h-3.5" /> Send to SUB-Station
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Combine the bed with your vocal in SUB-Station — they stay separate assets so
            each keeps its own authorship record.
          </p>
        </div>
      )}
    </div>
  );
}