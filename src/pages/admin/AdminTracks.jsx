import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Music, CheckCircle, XCircle, Clock, ExternalLink, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const STATUS_STYLE = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function AdminTracks() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updating, setUpdating] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.TrackSubmission.list("-created_date", 100);
    setTracks(data);
    setLoading(false);
  };

  const updateStatus = async (track, status) => {
    setUpdating(track.id);
    await base44.entities.TrackSubmission.update(track.id, { status });
    setTracks(prev => prev.map(t => t.id === track.id ? { ...t, status } : t));
    toast.success(`Track ${status}`);
    setUpdating(null);
  };

  const filtered = tracks.filter(t => {
    const matchSearch = !search || t.title?.toLowerCase().includes(search.toLowerCase()) || t.artist_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-foreground mb-1">Track Submissions</h1>
          <p className="text-muted-foreground text-sm">Review and approve/reject submitted tracks</p>
        </div>
        <Badge variant="outline" className="text-xs">{tracks.filter(t => t.status === "pending").length} pending</Badge>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tracks…" className="pl-9 rounded-xl" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
          <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No tracks found</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Track</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden md:table-cell">Artist</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden lg:table-cell">Genre</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(track => (
                <tr key={track.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-800 to-indigo-900 flex-shrink-0 overflow-hidden">
                        {track.cover_image_url ? <img src={track.cover_image_url} alt={track.title} className="w-full h-full object-cover" /> : <Music className="w-4 h-4 m-2.5 text-white/30" />}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{track.title}</p>
                        <p className="text-xs text-muted-foreground">{track.ai_tools_used || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground hidden md:table-cell">{track.artist_name}</td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    {track.genre && <Badge variant="outline" className="text-xs capitalize">{track.genre}</Badge>}
                  </td>
                  <td className="px-5 py-4">
                    <Badge className={`text-xs ${STATUS_STYLE[track.status]}`}>{track.status}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      {track.track_url && (
                        <a href={track.track_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                      {track.status !== "approved" && (
                        <Button size="sm" onClick={() => updateStatus(track, "approved")} disabled={updating === track.id}
                          className="h-7 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1">
                          <CheckCircle className="w-3 h-3" /> Approve
                        </Button>
                      )}
                      {track.status !== "rejected" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(track, "rejected")} disabled={updating === track.id}
                          className="h-7 px-3 rounded-lg border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs gap-1">
                          <XCircle className="w-3 h-3" /> Reject
                        </Button>
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