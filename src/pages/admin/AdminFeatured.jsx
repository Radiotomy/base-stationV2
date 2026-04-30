import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Star, CheckCircle, XCircle, Clock, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const STATUS_STYLE = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  waitlisted: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export default function AdminFeatured() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [updating, setUpdating] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.FeaturedArtistApplication.list("-created_date", 100);
    setApps(data);
    setLoading(false);
  };

  const updateStatus = async (app, status) => {
    setUpdating(app.id);
    const extra = status === "approved" ? { featured_since: new Date().toISOString().split("T")[0] } : {};
    await base44.entities.FeaturedArtistApplication.update(app.id, { status, ...extra });
    setApps(prev => prev.map(a => a.id === app.id ? { ...a, status, ...extra } : a));
    toast.success(`Application ${status}`);
    setUpdating(null);
  };

  const filtered = apps.filter(a => {
    const matchSearch = !search || a.artist_name?.toLowerCase().includes(search.toLowerCase()) || a.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-foreground mb-1">Featured Artist Applications</h1>
          <p className="text-muted-foreground text-sm">Review and approve artist spotlight applications</p>
        </div>
        <Badge variant="outline" className="text-xs">{apps.filter(a => a.status === "pending").length} pending</Badge>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search artists…" className="pl-9 rounded-xl" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="waitlisted">Waitlisted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
          <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No applications found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(app => (
            <div key={app.id} className="p-5 rounded-2xl bg-card border border-border hover:border-yellow-500/20 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-black text-foreground">{app.artist_name}</p>
                    <Badge className={`text-xs ${STATUS_STYLE[app.status]}`}>{app.status}</Badge>
                    {app.genre && <Badge variant="outline" className="text-xs capitalize">{app.genre}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{app.email} · {app.ai_tools_used || "—"}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{app.bio}</p>
                  {app.why_featured && <p className="text-sm text-foreground/80 mt-2 italic line-clamp-2">"{app.why_featured}"</p>}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {app.sample_track_url && (
                    <a href={app.sample_track_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="rounded-xl h-8 gap-1 text-xs w-full">
                        <ExternalLink className="w-3 h-3" /> Listen
                      </Button>
                    </a>
                  )}
                  {app.status !== "approved" && (
                    <Button size="sm" onClick={() => updateStatus(app, "approved")} disabled={updating === app.id}
                      className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1">
                      <CheckCircle className="w-3 h-3" /> Approve
                    </Button>
                  )}
                  {app.status !== "rejected" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(app, "rejected")} disabled={updating === app.id}
                      className="h-8 rounded-xl border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs gap-1">
                      <XCircle className="w-3 h-3" /> Reject
                    </Button>
                  )}
                  {app.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(app, "waitlisted")} disabled={updating === app.id}
                      className="h-8 rounded-xl text-xs gap-1">
                      <Clock className="w-3 h-3" /> Waitlist
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}