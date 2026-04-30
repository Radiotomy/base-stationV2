import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Volume2, Trash2, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';

export default function MultiTrackMixer({ tracks = [], onChange }) {
  const [mixer, setMixer] = useState(
    tracks.reduce((acc, t, i) => ({
      ...acc,
      [t.id]: { volume: 100, pan: 0, muted: false, solo: false, locked: false }
    }), {})
  );

  const updateTrack = (trackId, key, value) => {
    const updated = { ...mixer, [trackId]: { ...mixer[trackId], [key]: value } };
    setMixer(updated);
    onChange?.(updated);
  };

  const muteTrack = (trackId) => updateTrack(trackId, 'muted', !mixer[trackId].muted);
  const soloTrack = (trackId) => updateTrack(trackId, 'solo', !mixer[trackId].solo);
  const lockTrack = (trackId) => updateTrack(trackId, 'locked', !mixer[trackId].locked);
  const deleteTrack = (trackId) => {
    const updated = { ...mixer };
    delete updated[trackId];
    setMixer(updated);
    onChange?.(updated);
    toast.success('Track removed');
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3 overflow-x-auto">
      <div className="flex gap-4 pb-2">
        {tracks.map((track) => (
          <div key={track.id} className="flex-shrink-0 w-24 p-3 bg-muted/50 rounded-xl space-y-2">
            {/* Track Header */}
            <p className="text-xs font-semibold text-foreground truncate">{track.name}</p>

            {/* Volume Control */}
            <div className="space-y-1">
              <Slider
                value={[mixer[track.id]?.volume || 100]}
                onValueChange={([v]) => updateTrack(track.id, 'volume', v)}
                max={100}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground text-center">{mixer[track.id]?.volume || 100}%</p>
            </div>

            {/* Pan Control */}
            <div className="space-y-1">
              <Slider
                value={[mixer[track.id]?.pan || 0]}
                onValueChange={([p]) => updateTrack(track.id, 'pan', p)}
                min={-100}
                max={100}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground text-center">
                {mixer[track.id]?.pan > 0 ? 'R' : mixer[track.id]?.pan < 0 ? 'L' : 'C'}
              </p>
            </div>

            {/* Controls */}
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => muteTrack(track.id)}
                className={`h-6 w-6 rounded-md ${mixer[track.id]?.muted ? 'bg-destructive/20 text-destructive' : ''}`}
              >
                <Volume2 className="w-3 h-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => lockTrack(track.id)}
                className={`h-6 w-6 rounded-md ${mixer[track.id]?.locked ? 'bg-yellow-500/20 text-yellow-400' : ''}`}
              >
                {mixer[track.id]?.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => deleteTrack(track.id)}
                className="h-6 w-6 rounded-md text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}