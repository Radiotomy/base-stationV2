import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Search, ExternalLink, Shield, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function AdminArtists() {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.ArtistProfile.list("-created_date", 100);
    setArtists(data);
    setLoading(false);
  };

  const toggleVerified = async (artist) => {
    setUpdating(artist.id);
    const newVal = !artist.is_verified;
    await base44.entities.ArtistProfile.update(artist.id, { is_verified: newVal });
    setArtists(prev => prev.map(a => a.id === artist.id ? { ...a, is_verified: newVal } : a));
    toast.success(newVal ? "Artist verified!" : "Verification removed");
    setUpdating(null);
  };

  const filtered = artists.filter(a =>
    !search || a.display_name?.toLowerCase().includes(search.toLowerCase()) || a.user_email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-black text-foreground mb-1">Artists</h1>
        <p className="text-muted-foreground text-sm">Manage artist profiles and verification</p>
      </div>

      <div className="relative max-w-xs mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search artists…" className="pl-9 rounded-xl" />
      </div>

      {loading ? (
        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No artists found</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Artist</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden md:table-cell">Genre</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden lg:table-cell">Tracks</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(artist => (
                <tr key={artist.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {artist.avatar_url ? (
                        <img src={artist.avatar_url} alt={artist.display_name} className="w-9 h-9 rounded-lg object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                          {(artist.display_name || "?")[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-foreground">{artist.display_name}</p>
                        <p className="text-xs text-muted-foreground">{artist.user_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground hidden md:table-cell capitalize">{artist.genre || "—"}</td>
                  <td className="px-5 py-4 text-muted-foreground hidden lg:table-cell">{artist.track_count || 0}</td>
                  <td className="px-5 py-4">
                    {artist.is_verified ? (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">✓ Verified</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Unverified</Badge>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <Link to={`/artist/${artist.user_id}`} target="_blank">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-xl">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                      <Button size="sm" variant="outline" onClick={() => toggleVerified(artist)} disabled={updating === artist.id}
                        className={`h-8 px-3 rounded-xl text-xs gap-1 ${artist.is_verified ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-blue-500/30 text-blue-400 hover:bg-blue-500/10"}`}>
                        {artist.is_verified ? <><ShieldOff className="w-3 h-3" /> Unverify</> : <><Shield className="w-3 h-3" /> Verify</>}
                      </Button>
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