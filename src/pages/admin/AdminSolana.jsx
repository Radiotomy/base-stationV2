import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, ExternalLink, Search, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const STATUS_STYLE = {
  registered: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function AdminSolana() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.SolanaTrackRegistry.list("-created_date", 100);
    setRecords(data);
    setLoading(false);
  };

  const filtered = records.filter(r =>
    !search || r.track_title?.toLowerCase().includes(search.toLowerCase()) || r.artist_name?.toLowerCase().includes(search.toLowerCase())
  );

  const shortHash = (h) => h ? `${h.slice(0, 12)}…${h.slice(-6)}` : "—";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-black text-foreground mb-1">Solana Registry</h1>
        <p className="text-muted-foreground text-sm">All on-chain track registrations</p>
      </div>

      <div className="relative max-w-xs mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search registrations…" className="pl-9 rounded-xl" />
      </div>

      {loading ? (
        <div className="space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No registrations found</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Track</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden md:table-cell">Artist</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden lg:table-cell">Fingerprint</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(rec => (
                <tr key={rec.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-foreground">{rec.track_title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{rec.genre || "—"} · {rec.ai_tools_used || "—"}</p>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground hidden md:table-cell">{rec.artist_name}</td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-muted-foreground">{shortHash(rec.fingerprint_hash)}</span>
                      {rec.fingerprint_hash && (
                        <button onClick={() => { navigator.clipboard.writeText(rec.fingerprint_hash); toast.success("Copied!"); }}
                          className="text-muted-foreground hover:text-foreground">
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge className={`text-xs ${STATUS_STYLE[rec.registration_status]}`}>{rec.registration_status}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      {rec.transaction_signature && (
                        <a href={`https://solscan.io/tx/${rec.transaction_signature}?cluster=devnet`} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="h-8 px-3 rounded-xl text-xs gap-1">
                            <ExternalLink className="w-3 h-3" /> Solscan
                          </Button>
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}