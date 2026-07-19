import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Users, Search, Shield, Music, Image as ImageIcon, FileText, Zap, Coins, ChevronRight, Mail, Calendar, X, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import UserDetailPanel from "@/components/admin/UserDetailPanel";
import BetaRequestsPanel from "@/components/admin/BetaRequestsPanel";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [tracksByUser, setTracksByUser] = useState({});
  const [assetsByUser, setAssetsByUser] = useState({});
  const [xpByUser, setXpByUser] = useState({});
  const [creditsByUser, setCreditsByUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.User.list("-created_date", 500),
      base44.entities.TrackSubmission.list("-created_date", 1000),
      base44.entities.UserAsset.list("-created_date", 1000),
      base44.entities.UserXP.list("-total_xp", 500),
      base44.entities.UserCredit.list("-created_date", 500),
    ]).then(([u, tracks, assets, xp, credits]) => {
      setUsers(u);

      const groupBy = (rows, key) => rows.reduce((acc, r) => {
        const k = r[key]; if (!k) return acc;
        (acc[k] = acc[k] || []).push(r); return acc;
      }, {});
      setTracksByUser(groupBy(tracks, "artist_email"));
      setAssetsByUser(groupBy(assets, "user_email"));

      const xpMap = {}; xp.forEach(x => { if (x.user_email) xpMap[x.user_email] = x; });
      setXpByUser(xpMap);
      const credMap = {}; credits.forEach(c => { if (c.user_email) credMap[c.user_email] = c; });
      setCreditsByUser(credMap);

      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return users.filter(u => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!term) return true;
      return (u.email || "").toLowerCase().includes(term) || (u.full_name || "").toLowerCase().includes(term);
    });
  }, [users, q, roleFilter]);

  const totals = useMemo(() => ({
    users: users.length,
    admins: users.filter(u => u.role === "admin").length,
    creators: users.filter(u => u.data?.is_creator !== false).length,
    tracks: Object.values(tracksByUser).reduce((s, a) => s + a.length, 0),
    assets: Object.values(assetsByUser).reduce((s, a) => s + a.length, 0),
  }), [users, tracksByUser, assetsByUser]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-foreground mb-1">Users</h1>
          <p className="text-muted-foreground text-sm">Registered accounts, their content, and activity</p>
        </div>
        <div className="flex gap-2 flex-wrap text-xs">
          <Stat label="Total" value={totals.users} />
          <Stat label="Admins" value={totals.admins} />
          <Stat label="Creators" value={totals.creators} />
          <Stat label="Tracks" value={totals.tracks} />
          <Stat label="Assets" value={totals.assets} />
        </div>
      </div>

      {/* Pending beta access requests */}
      <BetaRequestsPanel />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or email…" value={q} onChange={e => setQ(e.target.value)} className="pl-9 rounded-xl" />
        </div>
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
          {["all", "admin", "user"].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${roleFilter === r ? "bg-purple-500/20 text-purple-300" : "text-muted-foreground hover:text-foreground"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array(8).fill(0).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground text-sm bg-card border border-border rounded-2xl">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          No users match these filters.
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden md:table-cell">Role</th>
                <th className="text-center px-4 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Tracks</th>
                <th className="text-center px-4 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden sm:table-cell">Assets</th>
                <th className="text-center px-4 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden lg:table-cell">XP</th>
                <th className="text-center px-4 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden lg:table-cell">Credits</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden md:table-cell">Joined</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((u, i) => {
                const tracks = tracksByUser[u.email] || [];
                const assets = assetsByUser[u.email] || [];
                const xp = xpByUser[u.email];
                const credit = creditsByUser[u.email];
                return (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                    onClick={() => setSelectedUser(u)}
                    className="hover:bg-muted/30 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${u.role === "admin" ? "bg-purple-500/20 text-purple-300" : "bg-blue-500/20 text-blue-300"}`}>
                          {(u.full_name || u.email || "?")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{u.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-purple-500/20 text-purple-300" : "bg-muted text-muted-foreground"}`}>
                        {u.role === "admin" && <Shield className="w-3 h-3" />}
                        {u.role || "user"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-foreground">{tracks.length}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground hidden sm:table-cell">{assets.length}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground hidden lg:table-cell">{xp?.total_xp ?? 0}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground hidden lg:table-cell">{credit?.balance ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{u.created_date ? new Date(u.created_date).toLocaleDateString() : "—"}</td>
                    <td className="px-2 py-3 text-muted-foreground"><ChevronRight className="w-4 h-4" /></td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Panel */}
      {selectedUser && (
        <UserDetailPanel
          user={selectedUser}
          tracks={tracksByUser[selectedUser.email] || []}
          assets={assetsByUser[selectedUser.email] || []}
          xp={xpByUser[selectedUser.email]}
          credit={creditsByUser[selectedUser.email]}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="px-3 py-1.5 rounded-xl bg-card border border-border">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-bold text-foreground">{value}</span>
    </div>
  );
}