import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, SkipBack, Loader2, Download, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import useStemDeck from '@/hooks/useStemDeck';
import StemLane from '@/components/stems/StemLane';
import { renderMixdown } from '@/utils/renderMixdown';
import { sendAssetToSubStation } from '@/lib/substation/handoff';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Stem Deck — all separated stems on one transport, mixed live.
 * Balancing happens here; arranging and processing happens in SUB-Station.
 */
export default function StemDeck({ stems }) {
  const navigate = useNavigate();
  const { mix, setLane, play, pause, seek, playing, position, duration, loading, error } = useStemDeck(stems);
  const [bouncing, setBouncing] = useState(false);

  const bounce = async () => {
    setBouncing(true);
    try {
      const { blob } = await renderMixdown(stems.map(s => ({ url: s.file_url, ...mix[s.id] })));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stem-mix.wav';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Mix bounced to a 24-bit WAV');
    } catch (e) {
      toast.error(e.message || 'Bounce failed');
    } finally {
      setBouncing(false);
    }
  };

  const sendAll = () => {
    stems.forEach(sendAssetToSubStation);
    navigate('/sub-station');
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      {/* Transport */}
      <div className="flex items-center gap-3">
        <Button size="icon" onClick={playing ? pause : play} disabled={loading}
          className="h-9 w-9 rounded-full bg-emerald-600 hover:bg-emerald-500 shrink-0">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" />
            : playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={() => seek(0)} className="h-8 w-8 shrink-0">
          <SkipBack className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div
            className="h-2 rounded-full bg-muted cursor-pointer relative"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              seek(((e.clientX - r.left) / r.width) * duration);
            }}
          >
            <div className="h-full rounded-full bg-emerald-500"
              style={{ width: duration ? `${(position / duration) * 100}%` : '0%' }} />
          </div>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
          {fmt(position)} / {duration ? fmt(duration) : '—:—'}
        </span>
      </div>

      {loading && (
        <p className="text-[11px] text-muted-foreground">Loading all stems so they play in sync…</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Lanes */}
      <div className="space-y-2">
        {stems.map(stem => (
          <StemLane key={stem.id} stem={stem} state={mix[stem.id]}
            onChange={(p) => setLane(stem.id, p)} />
        ))}
      </div>

      {/* Hand-offs */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="outline" onClick={bounce} disabled={bouncing}
          className="rounded-xl gap-2 text-xs font-bold">
          {bouncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Bounce This Mix
        </Button>
        <Button variant="outline" onClick={sendAll} className="rounded-xl gap-2 text-xs font-bold">
          <Sliders className="w-3.5 h-3.5" />
          Send All to SUB-Station
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Balance and solo here; send the stems to SUB-Station for timeline editing, effects and automation.
      </p>
    </div>
  );
}