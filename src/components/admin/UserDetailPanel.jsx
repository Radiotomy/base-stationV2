import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, Mail, Calendar, Music, Image as ImageIcon, FileText, Film, Zap, Coins, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import AdminCreditEditor from "@/components/admin/AdminCreditEditor";

const ASSET_ICON = {
  track: Music, lyric: FileText, coverart: ImageIcon, video: Film,
  stem: Music, master: Music, harmony: Music, mashup: Music, visualizer: Film, project: FileText,
};

export default function UserDetailPanel({ user, tracks, assets, xp, credit, onClose }) {
  const [liveCredit, setLiveCredit] = useState(credit);
  const assetGroups = assets.reduce((acc, a) => {
    (acc[a.asset_type] = acc[a.asset_type] || []).push(a);
    return acc;
  }, {});

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={onClose}>
        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.25 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-2xl h-full bg-card border-l border-border overflow-y-auto">

          {/* Header */}
          <div className="sticky top-0 bg-card border-b border-border p-5 flex items-start justify-between gap-3 z-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${user.role === "admin" ? "bg-purple-500/20 text-purple-300" : "bg-blue-500/20 text-blue-300"}`}>
                {(user.full_name || user.email)[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-foreground text-lg truncate">{user.full_name || "—"}</h2>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {user.email}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X className="w-5 h-5" /></button>
          </div>

          <div className="p-5 space-y-6">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Meta label="Role" value={
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${user.role === "admin" ? "bg-purple-500/20 text-purple-300" : "bg-muted text-muted-foreground"}`}>
                  {user.role === "admin" && <Shield className="w-3 h-3" />}{user.role || "user"}
                </span>
              } />
              <Meta label="Joined" value={user.created_date ? new Date(user.created_date).toLocaleDateString() : "—"} />
              <Meta label="Verified" value={user.is_verified ? "Yes" : "No"} />
              <Meta label="Creator" value={user.data?.is_creator !== false ? "Yes" : "No"} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBlock icon={Music} label="Tracks" value={tracks.length} color="text-purple-400" />
              <StatBlock icon={ImageIcon} label="Assets" value={assets.length} color="text-blue-400" />
              <StatBlock icon={Zap} label="Total XP" value={xp?.total_xp ?? 0} color="text-yellow-400" sub={`Lvl ${xp?.level ?? 1}`} />
              <StatBlock icon={Coins} label="Credits" value={liveCredit?.balance ?? 0} color="text-emerald-400" sub={liveCredit?.is_premium ? "Premium" : "Free"} />
            </div>

            {/* Admin credit management */}
            <AdminCreditEditor user={user} credit={liveCredit} onUpdated={setLiveCredit} />

            {/* Tracks */}
            <Section title="Submitted Tracks" count={tracks.length}>
              {tracks.length === 0 ? <Empty text="No track submissions yet." /> : (
                <div className="space-y-2">
                  {tracks.slice(0, 20).map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-2 rounded-xl bg-muted/30">
                      <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                        {t.cover_image_url ? <img src={t.cover_image_url} alt="" className="w-full h-full object-cover" /> : <Music className="w-4 h-4 m-3 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.genre || "—"} · {new Date(t.created_date).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.status === "approved" ? "bg-emerald-500/20 text-emerald-400" : t.status === "rejected" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                        {t.status}
                      </span>
                    </div>
                  ))}
                  {tracks.length > 20 && <p className="text-xs text-muted-foreground text-center py-1">+ {tracks.length - 20} more</p>}
                </div>
              )}
            </Section>

            {/* Assets by type */}
            <Section title="Generated Assets" count={assets.length}>
              {assets.length === 0 ? <Empty text="No assets generated yet." /> : (
                <div className="space-y-3">
                  {Object.entries(assetGroups).map(([type, items]) => {
                    const Icon = ASSET_ICON[type] || FileText;
                    return (
                      <div key={type}>
                        <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <Icon className="w-3.5 h-3.5" /> {type} <span className="text-foreground">({items.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {items.slice(0, 8).map(a => (
                            <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                              <div className="w-8 h-8 rounded bg-muted overflow-hidden flex-shrink-0">
                                {a.thumbnail_url || a.file_url?.match(/\.(jpg|jpeg|png|webp)$/i) ?
                                  <img src={a.thumbnail_url || a.file_url} alt="" className="w-full h-full object-cover" /> :
                                  <Icon className="w-3.5 h-3.5 m-2 text-muted-foreground" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">{a.title}</p>
                                <p className="text-[10px] text-muted-foreground">{new Date(a.created_date).toLocaleDateString()}</p>
                              </div>
                              {a.file_url && (
                                <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" onClick={e => e.stopPropagation()}>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                        {items.length > 8 && <p className="text-[10px] text-muted-foreground mt-1">+ {items.length - 8} more {type}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Meta({ label, value }) {
  return (
    <div className="p-3 rounded-xl bg-muted/30">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function StatBlock({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="p-3 rounded-xl bg-muted/30">
      <Icon className={`w-4 h-4 mb-1.5 ${color}`} />
      <p className="text-xl font-black text-foreground leading-none">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}{sub && <span className="ml-1 opacity-60">· {sub}</span>}</p>
    </div>
  );
}

function Section({ title, count, children }) {
  return (
    <div>
      <h3 className="text-sm font-black text-foreground mb-2 flex items-center gap-2">
        {title} <span className="text-xs font-semibold text-muted-foreground">({count})</span>
      </h3>
      {children}
    </div>
  );
}

function Empty({ text }) {
  return <p className="text-xs text-muted-foreground italic px-3 py-4 text-center bg-muted/20 rounded-xl">{text}</p>;
}