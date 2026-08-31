import { Laptop, Loader2, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import useLocalStemSeparation from '@/hooks/useLocalStemSeparation';

const PHASE_COPY = {
  model: 'Downloading the model (136 MB, one time per device)',
  decoding: 'Decoding your track',
  separating: 'Separating on your device',
  uploading: 'Saving stems to your library',
};

/**
 * On-device separation control. Deliberately states the real trade-off up
 * front: this is the private, free path, not the fast one.
 */
export default function OnDeviceStemPanel({ asset, onComplete }) {
  const { run, phase, progress, chunkInfo, error } = useLocalStemSeparation();
  const busy = phase !== 'idle' && phase !== 'done';

  const start = async () => {
    try {
      const stems = await run(asset);
      toast.success(`Separated ${stems.length} stems on your device`, { icon: '💻' });
      onComplete?.(stems);
    } catch {
      /* error surfaced inline below */
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Laptop className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-black">On-Device Separation</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Runs the same six-stem model inside this browser tab. Your audio never leaves
        your machine and it costs no credits — but it's roughly real-time, so a
        3-minute track takes a few minutes. Desktop recommended.
      </p>

      {busy && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            {PHASE_COPY[phase]}
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          {phase === 'separating' && chunkInfo && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Cpu className="w-3 h-3" />
              {Math.round(progress * chunkInfo.chunks)} of {chunkInfo.chunks} chunks — keep
              this tab open
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button
        onClick={start}
        disabled={busy || !asset}
        variant="outline"
        className="w-full rounded-xl gap-2 font-bold"
      >
        <Laptop className="w-4 h-4" />
        {busy ? 'Working…' : 'Separate On My Device'}
      </Button>
    </div>
  );
}