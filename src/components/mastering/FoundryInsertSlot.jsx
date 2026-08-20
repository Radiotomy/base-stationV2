import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Cpu, X, AlertTriangle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isInsertable, insertRejectReason } from '@/lib/foundry/foundryInsert';

// Foundry insert slot for the Mastering Studio.
// Selecting a patch only re-routes the PREVIEW — it becomes part of the audio
// when the creator renders, which is why the copy says "auditioning" here.
export default function FoundryInsertSlot({ selected, onSelect }) {
  const [patches, setPatches] = useState(null);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      const rows = await base44.entities.FoundryPlugin.filter({ user_id: me.id }, '-updated_date', 30);
      setPatches(rows.filter((p) => isInsertable(p.graph_state)));
    })().catch(() => setPatches([]));
  }, []);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#FF9A4D]" /> Foundry Insert
        </h3>
        {selected && (
          <Button size="sm" variant="ghost" onClick={() => onSelect(null)} className="h-6 px-2 text-[10px]">
            <X className="w-3 h-3 mr-1" /> Remove
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Run the master through one of your own patches, pre-limiter. Audition freely — it only
        becomes part of the audio when you render.
      </p>

      {patches === null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading patches…
        </div>
      )}

      {patches?.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5 text-foreground/80 mb-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" /> No insertable patches yet
          </p>
          An insert needs an Insert Input and an Output so audio can pass through it.{' '}
          <Link to="/foundry" className="text-[#FFC98A] underline">Build one in BASE Foundry</Link>.
        </div>
      )}

      <div className="space-y-1.5">
        {(patches || []).map((p) => {
          const active = selected?.id === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(active ? null : p)}
              className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all ${
                active ? 'border-[#FF9A4D] bg-[#FF9A4D]/10' : 'border-border bg-muted/30 hover:border-[#FF9A4D]/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-foreground truncate">{p.title}</p>
                <Badge variant="outline" className="text-[9px] shrink-0">
                  {(p.graph_state?.nodes || []).length} modules
                </Badge>
              </div>
              {p.description && <p className="text-muted-foreground text-[10px] line-clamp-1">{p.description}</p>}
            </button>
          );
        })}
      </div>

      {selected && !isInsertable(selected.graph_state) && (
        <p className="text-[10px] text-destructive">{insertRejectReason(selected.graph_state)}</p>
      )}
    </div>
  );
}