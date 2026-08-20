import { useState } from 'react';
import { Play, Pause, Volume2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { base44 } from '@/api/base44Client';

/**
 * Transport for the venue's in-room audio, shown inside the 3D space.
 *
 * The controls act on the ROOM, not on one listener: Portals audio is a property
 * of a placed object, so everyone standing in the venue shares one emitter and
 * therefore one level. Each change re-pushes the stage, which is also what makes
 * it stick across the next track.
 */
export default function VenueRoomAudioControls({ venueId, volume = 0.8, paused = false }) {
  const [level, setLevel] = useState(Math.round(volume * 100));
  const [isPaused, setIsPaused] = useState(paused);
  const [busy, setBusy] = useState(false);

  const apply = async (patch) => {
    if (!venueId) return;
    setBusy(true);
    try {
      await base44.functions.invoke('advanceVenueStages', { venueId, ...patch });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="merc-card rounded-2xl p-4 flex items-center gap-4">
      <Button
        size="icon"
        disabled={busy || !venueId}
        onClick={() => {
          const next = !isPaused;
          setIsPaused(next);
          apply({ paused: next });
        }}
        className="rounded-full w-11 h-11 merc-button flex-shrink-0"
      >
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
      </Button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Room volume · {level}%
          </p>
        </div>
        <Slider
          value={[level]}
          min={0}
          max={100}
          step={5}
          disabled={busy || !venueId}
          onValueChange={([v]) => setLevel(v)}
          onValueCommit={([v]) => apply({ volume: v / 100 })}
        />
      </div>
    </div>
  );
}