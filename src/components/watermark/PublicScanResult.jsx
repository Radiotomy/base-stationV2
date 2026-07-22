import { ShieldCheck, ShieldX, Music } from 'lucide-react';

export default function PublicScanResult({ result, matches }) {
  if (!result) return null;
  return (
    <div className={`rounded-xl border p-5 space-y-3 text-sm ${result.detected ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-border bg-secondary/40'}`}>
      {result.detected ? (
        <>
          <p className="flex items-center gap-2 text-emerald-400 font-semibold text-base">
            <ShieldCheck className="w-5 h-5" /> BASE Mark detected
          </p>
          <p>Payload: <code className="text-[#FFC98A]">{result.payload_hex}</code></p>
          {matches === null ? (
            <p className="text-muted-foreground">Checking the registry…</p>
          ) : matches.length > 0 ? (
            <div className="pt-1 space-y-1">
              <p className="font-semibold text-foreground">Registered as:</p>
              {matches.map((m, i) => (
                <p key={i} className="flex items-center gap-2 text-muted-foreground">
                  <Music className="w-3.5 h-3.5 text-[#FF9A4D]" />
                  {m.title}
                  <span className="text-xs">({m.asset_type}, marked {new Date(m.marked_at || m.created_date).toLocaleDateString()})</span>
                </p>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Mark detected, but no matching track found in the public registry.</p>
          )}
        </>
      ) : (
        <p className="flex items-center gap-2 text-muted-foreground">
          <ShieldX className="w-4 h-4" /> No BASE Mark found in this file.{result.reason ? ` ${result.reason}` : ''}
        </p>
      )}
    </div>
  );
}