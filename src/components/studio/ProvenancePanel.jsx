import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Shield, Cpu, Layers, Combine, Sparkles, Film, Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Phase 3 — Provenance Viewer
 * Displays the full creative lineage of an asset:
 *   - origin
 *   - providers used
 *   - stems used
 *   - remix sources
 *   - mastering profile
 *   - visualizer style
 *
 * Props: { assetId } OR { asset }
 */
export default function ProvenancePanel({ assetId, asset: assetProp }) {
  const [asset, setAsset] = useState(assetProp || null);
  const [sources, setSources] = useState([]);

  useEffect(() => {
    if (assetProp) { setAsset(assetProp); return; }
    if (!assetId) return;
    base44.entities.UserAsset.filter({ id: assetId })
      .then(arr => setAsset(arr[0] || null))
      .catch(() => {});
  }, [assetId, assetProp]);

  useEffect(() => {
    const ids = asset?.metadata?.provenance?.remix_sources || [];
    if (ids.length === 0) { setSources([]); return; }
    Promise.all(ids.map(id => base44.entities.UserAsset.filter({ id }).then(r => r[0]).catch(() => null)))
      .then(rows => setSources(rows.filter(Boolean)));
  }, [asset?.id]);

  if (!asset) return null;
  const m = asset.metadata || {};
  const p = m.provenance || {};

  const items = [
    p.created_by && { icon: Cpu, label: 'Created By', value: p.created_by.replace(/_/g, ' ') },
    p.providers_used?.length && { icon: Shield, label: 'Providers', value: p.providers_used.join(', ') },
    p.mastering_profile && { icon: Sparkles, label: 'Mastering', value: p.mastering_profile },
    p.visualizer_style && { icon: Film, label: 'Visualizer', value: p.visualizer_style },
    asset.stem_type && { icon: Layers, label: 'Stem Type', value: asset.stem_type },
  ].filter(Boolean);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-black text-foreground">Provenance</h3>
        <Badge className="ml-auto capitalize bg-muted/50 text-muted-foreground border-0">{asset.origin || 'creator'}</Badge>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {items.map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-muted/40 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3 h-3 text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-semibold uppercase">{label}</p>
              </div>
              <p className="text-sm font-bold text-foreground truncate capitalize">{value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No provenance metadata recorded.</p>
      )}

      {sources.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
            <Combine className="w-3 h-3" /> Remix Sources
          </p>
          <div className="space-y-1.5">
            {sources.map(s => (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-700 to-indigo-800 flex-shrink-0 overflow-hidden">
                  {s.thumbnail_url && <img src={s.thumbnail_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <p className="text-xs font-bold text-foreground truncate flex-1">{s.title}</p>
                <Badge variant="outline" className="text-xs capitalize">{s.origin}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {m.content_hash && (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
          <Hash className="w-3 h-3 text-emerald-400 flex-shrink-0" />
          <p className="text-xs font-mono text-muted-foreground truncate">{m.content_hash}</p>
        </div>
      )}
    </div>
  );
}