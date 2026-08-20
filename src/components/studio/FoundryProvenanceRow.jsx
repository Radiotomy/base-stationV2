import { Link } from 'react-router-dom';
import { Cpu, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Shows the Foundry patch that was baked into a rendered asset.
 *
 * Reads ONLY the snapshot stored on the asset at render time — never the live
 * FoundryPlugin record. If the creator later edits or deletes that patch, this
 * must keep describing the chain that actually shaped THIS audio; resolving the
 * plugin live would silently rewrite history.
 */
export default function FoundryProvenanceRow({ insert }) {
  if (!insert) return null;
  const units = insert.parameter_snapshot?.units || [];

  return (
    <div className="p-3 rounded-xl bg-[#FF9A4D]/5 border border-[#FF9A4D]/20 space-y-2">
      <div className="flex items-center gap-2">
        <Cpu className="w-3.5 h-3.5 text-[#FF9A4D] flex-shrink-0" />
        <p className="text-xs font-bold text-foreground truncate flex-1">
          Foundry patch baked: {insert.title || 'Untitled patch'}
        </p>
        {typeof insert.plugin_human_score === 'number' && (
          <Badge variant="outline" className="text-[9px] flex-shrink-0">
            design {insert.plugin_human_score}/100
          </Badge>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Your own DSP chain shaped this render — a hand-built signal path, not a preset.
      </p>

      {units.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {units.map((u, i) => (
            <span key={u.id || i} className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
              {u.label || u.type}
            </span>
          ))}
        </div>
      )}

      {insert.plugin_id && (
        <Link
          to={`/foundry/${insert.plugin_id}`}
          className="inline-flex items-center gap-1 text-[10px] text-[#FFC98A] hover:underline"
        >
          Open in Foundry <ExternalLink className="w-2.5 h-2.5" />
        </Link>
      )}
    </div>
  );
}