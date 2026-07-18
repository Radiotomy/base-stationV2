import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { ShieldAlert, FileKey2 } from 'lucide-react';
import FlagReportDialog from '@/components/governance/FlagReportDialog';
import { FLAG_PLATFORMS, FLAG_STATUS } from '@/components/governance/governanceSignals';

const platformLabel = (v) => FLAG_PLATFORMS.find((p) => p.value === v)?.label || v;

export default function TransparencyRegistry({ user }) {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const f = await base44.entities.TransparencyFlag.list('-created_date', 100);
    setFlags(f || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Loading the registry…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
          When a DSP or distributor falsely flags a high-COS track despite a valid provenance
          manifest, log it here. Aggregated, anonymous-friendly evidence gives independent artists
          collective leverage — BASE Station acts as a block-clearing union, not just a toolkit.
        </p>
        <FlagReportDialog user={user} onCreated={load} />
      </div>

      {flags.length === 0 ? (
        <div className="p-8 rounded-2xl bg-card border border-dashed border-border text-center">
          <ShieldAlert className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-bold text-foreground mb-1">No false flags on record</p>
          <p className="text-xs text-muted-foreground">That's good news — but if a platform blocks your validated work, report it here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {flags.map((f) => {
            const status = FLAG_STATUS[f.status] || FLAG_STATUS.reported;
            return (
              <div key={f.id} className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-foreground truncate">{f.track_title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Flagged on {platformLabel(f.platform)}
                      {f.cos_score != null && <> · COS <span className="text-emerald-300 font-bold">{f.cos_score}</span></>}
                      {f.had_manifest && (
                        <span className="inline-flex items-center gap-1 ml-2 text-amber-300">
                          <FileKey2 className="w-3 h-3" /> manifest on file
                        </span>
                      )}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full border whitespace-nowrap ${status.cls}`}>
                    {status.label}
                  </span>
                </div>
                {f.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed mt-2">{f.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}