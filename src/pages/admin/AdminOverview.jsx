import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Music, Users, Trophy, Star, Shield, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle, Flag } from "lucide-react";
import { Link } from "react-router-dom";

function StatCard({ label, value, icon: Icon, color, sub, to }) {
  const inner = (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl bg-card border border-border hover:border-purple-500/30 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
      <p className="text-3xl font-black text-foreground mb-1">{value ?? "—"}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </motion.div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export default function AdminOverview() {
  const [stats, setStats] = useState({});
  const [recentTracks, setRecentTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Counts are sampled up to PAGE rows. Anything that fills the page is shown
  // as "N+" rather than silently reporting a wrong total.
  const PAGE = 1000;
  const count = (rows) => (rows.length >= PAGE ? `${PAGE}+` : rows.length);

  useEffect(() => {
    Promise.all([
      base44.entities.TrackSubmission.list("-created_date", PAGE),
      base44.entities.ArtistProfile.list("-created_date", PAGE),
      base44.entities.Challenge.list("-created_date", PAGE),
      base44.entities.FeaturedArtistApplication.filter({ status: "pending" }),
      base44.entities.SolanaTrackRegistry.list("-created_date", PAGE),
      base44.entities.TrackSubmission.list("-created_date", 5),
      base44.entities.OrvoReport.filter({ status: "open" }).catch(() => []),
    ]).then(([tracks, artists, challenges, pendingApps, solana, recent, openReports]) => {
      setStats({
        totalTracks: count(tracks),
        pendingTracks: tracks.filter(t => t.status === "pending").length,
        approvedTracks: tracks.filter(t => t.status === "approved").length,
        totalArtists: count(artists),
        activeChallenges: challenges.filter(c => c.status === "active").length,
        pendingApps: pendingApps.length,
        solanaRegistrations: count(solana),
        openReports: openReports.length,
      });
      setRecentTracks(recent);
      setLoading(false);
    });
  }, []);

  const statCards = [
    { label: "Total Tracks", value: stats.totalTracks, icon: Music, color: "bg-purple-600", to: "/admin/tracks" },
    { label: "Pending Review", value: stats.pendingTracks, icon: Clock, color: "bg-orange-600", to: "/admin/tracks", sub: "needs action" },
    { label: "Total Artists", value: stats.totalArtists, icon: Users, color: "bg-blue-600", to: "/admin/artists" },
    { label: "Active Challenges", value: stats.activeChallenges, icon: Trophy, color: "bg-pink-600", to: "/admin/challenges" },
    { label: "Featured Applications", value: stats.pendingApps, icon: Star, color: "bg-yellow-600", to: "/admin/featured", sub: "pending" },
    { label: "Solana Registrations", value: stats.solanaRegistrations, icon: Shield, color: "bg-violet-600", to: "/admin/solana" },
    { label: "Open Reports", value: stats.openReports, icon: Flag, color: "bg-red-600", to: "/admin/moderation", sub: "needs action" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-foreground mb-1">Admin Overview</h1>
        <p className="text-muted-foreground text-sm">Platform health and quick actions</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
            {statCards.map((c, i) => <StatCard key={c.label} {...c} />)}
          </div>

          {/* Recent Submissions */}
          <div>
            <h2 className="text-lg font-black text-foreground mb-4">Recent Track Submissions</h2>
            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              {recentTracks.length === 0 ? (
                <p className="text-muted-foreground text-sm p-6">No submissions yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Track</th>
                      <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden md:table-cell">Artist</th>
                      <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Status</th>
                      <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden md:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentTracks.map(t => (
                      <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3 font-medium text-foreground">{t.title}</td>
                        <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">{t.artist_name}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${t.status === "approved" ? "bg-emerald-500/20 text-emerald-400" : t.status === "rejected" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                            {t.status === "approved" ? <CheckCircle className="w-3 h-3" /> : t.status === "rejected" ? <XCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            {t.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground text-xs hidden md:table-cell">{new Date(t.created_date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}