import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Cpu, Loader2, Power } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { isInsertable } from '@/lib/foundry/foundryInsert';
import useLivePatchRack from '@/hooks/useLivePatchRack';

/**
 * Live Studio patch rack — up to 4 of the performer's own Foundry patches,
 * hot-swappable mid-set with a wet/dry macro. Live routing only: nothing here
 * writes to an asset, and the rack never touches BASE Mark or provenance.
 */
export default function LivePatchRack({ audioRef, hasTrack }) {
  const [patches, setPatches] = useState(null);
  const rack = useLivePatchRack(audioRef);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      const rows = await base44.entities.FoundryPlugin.filter({ user_id: me.id }, '-updated_date', 30);
      setPatches(rows.filter((p) => isInsertable(p.graph_state)).slice(0, 4));
    })().catch(() => setPatches([]));
  }, []);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-foreground text-sm flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#FF9A4D]" /> Patch Rack
        </h3>
        {rack.armed && (
          <Button size="sm" variant="ghost" onClick={() => rack.arm(null)} className="h-6 px-2 text-[10px]">
            <Power className="w-3 h-3 mr-1" /> Bypass
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Run the live mix through one of your own patches. Swap any time — this only routes
        what fans hear now, nothing is saved to the track.
      </p>

      {patches === null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading patches…
        </div>
      )}

      {patches?.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
          No insertable patches yet —{' '}
          <Link to="/foundry" className="text-[#FFC98A] underline">build one in BASE Foundry</Link>.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {(patches || []).map((p, i) => {
          const active = rack.armed?.id === p.id;
          return (
            <button
              key={p.id}
              disabled={rack.busy || !hasTrack}
              onClick={() => rack.arm(active ? null : p)}
              className={`p-2.5 rounded-xl border text-left text-xs transition-all disabled:opacity-40 ${
                active ? 'border-[#FF9A4D] bg-[#FF9A4D]/10' : 'border-border bg-muted/30 hover:border-[#FF9A4D]/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="font-mono text-[9px] text-muted-foreground">SLOT {i + 1}</span>
                {active && <Badge className="bg-[#FF9A4D]/20 text-[#FFC98A] border-0 text-[9px]">ON</Badge>}
              </div>
              <p className="font-bold text-foreground truncate">{p.title}</p>
            </button>
          );
        })}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-bold text-foreground">Macro · Amount</p>
          <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-[#FF9A4D]/20 text-[#FFC98A]">
            {rack.mix}%
          </span>
        </div>
        <Slider
          value={[rack.mix]}
          onValueChange={([v]) => rack.setMix(v)}
          min={0}
          max={100}
          step={1}
          disabled={!rack.armed}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
          <span>Dry</span><span>Patched</span>
        </div>
      </div>

      {!hasTrack && (
        <p className="text-[10px] text-muted-foreground">Select a track to arm the rack.</p>
      )}
    </div>
  );
}