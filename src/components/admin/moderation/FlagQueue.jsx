import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { ShieldAlert, FileKey2 } from 'lucide-react';
import { FLAG_PLATFORMS, FLAG_STATUS } from '@/components/governance/governanceSignals';
import { toast } from 'sonner';

const platformLabel = (v) => FLAG_PLATFORMS.find((p) => p.value === v)?.label || v;
const STATUSES = ['reported', 'investigating', 'resolved', 'escalated'];

/**
 * Admin side of the Transparency Registry. The public page lists false-flag
 * reports read-only; this is the only surface that advances their status.
 */
export default function FlagQueue() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const rows = await base44.entities.TransparencyFlag.list('-created_date', 200).catch(() => []);
    setFlags(rows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (flag, status) => {
    await base44.entities.TransparencyFlag.update(flag.id, { status });
    setFlags((prev) => prev.map((f) => (f.id === flag.id ? { ...f, status } : f)));
    toast.success(`Marked ${FLAG_STATUS[status].label.toLowerCase()}`);
  };

  if (loading) return <div className="h-24 rounded-2xl bg-muted animate-pulse" />;

  if (flags.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-card border border-dashed border-border text-center">
        <ShieldAlert className="w-6 h-6 text-muted-foreground mx-auto mb-2 opacity-40" />
        <p className="text-sm text-muted-foreground">No false-flag reports on record.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {flags.map((f) => {
        const current = f.status || 'reported';
        return (
          <div key={f.id} className="p-4 rounded-2xl bg-card border border-border">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-black text-foreground truncate">{f.track_title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {f.user_name || 'Anonymous'} · flagged on {platformLabel(f.platform)}
                  {f.cos_score != null && <> · COS <span className="text-emerald-300 font-bold">{f.cos_score}</span></>}
                  {f.had_manifest && (
                    <span className="inline-flex items-center gap-1 ml-2 text-amber-300">
                      <FileKey2 className="w-3 h-3" /> manifest on file
                    </span>
                  )}
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full border whitespace-nowrap ${FLAG_STATUS[current].cls}`}>
                {FLAG_STATUS[current].label}
              </span>
            </div>
            {f.description && (
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">{f.description}</p>
            )}
            <div className="flex gap-1 flex-wrap">
              {STATUSES.filter((s) => s !== current).map((s) => (
                <button
                  key={s} onClick={() => setStatus(f, s)}
                  className="px-2.5 py-1 rounded-lg border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-purple-500/40 transition"
                >
                  {FLAG_STATUS[s].label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}