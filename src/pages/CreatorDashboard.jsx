import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3, Music, Zap, TrendingUp, Eye, Heart,
  Image, FileText, ChevronRight, Clock, CheckCircle, Folder, History, RefreshCw,
  FolderOpen, Layers, Upload, Radio, Trophy, Award, ShieldCheck, Share2
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import CreditBalanceWidget from "@/components/credits/CreditBalanceWidget";
import XPWidget from "@/components/dashboard/XPWidget";
import ProjectsTab from "@/components/dashboard/ProjectsTab";
import GenerationHistoryTab from "@/components/dashboard/GenerationHistoryTab";
import UsageAnalytics from "@/components/dashboard/UsageAnalytics";
import PerTrackAnalytics from "@/components/dashboard/PerTrackAnalytics";
import TrackCard from "@/components/dashboard/TrackCard";
import WorkspaceSwitcher from "@/components/dashboard/WorkspaceSwitcher";
import CollectibleManagerPanel from "@/components/creator/CollectibleManagerPanel";
import RewardFansModal from "@/components/creator/RewardFansModal";
import TopFansAnalytics from "@/components/creator/TopFansAnalytics";
import SubmissionsTab from "@/components/dashboard/SubmissionsTab";
import LiveSessionsTab from "@/components/dashboard/LiveSessionsTab";
import OwnershipDashboard from "@/components/music/OwnershipDashboard";
import ProofOfOwnershipTab from "@/components/dashboard/ProofOfOwnershipTab";
import DistributionTab from "@/components/distribution/DistributionTab";
import MyLoopsTab from "@/components/loops/MyLoopsTab";
import CircuitTabBar from "@/components/dashboard/circuit/CircuitTabBar";
import WorkspaceSidebarNav from "@/components/dashboard/circuit/WorkspaceSidebarNav";
import WorkspaceStatsBar from "@/components/dashboard/circuit/WorkspaceStatsBar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function CreatorDashboard() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [assets, setAssets] = useState([]);
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get("tab") || "library";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [stats, setStats] = useState(null);
  const [usageLogs, setUsageLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assetFilter, setAssetFilter] = useState("all");
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => localStorage.getItem("bs_active_workspace") || "all");
  const navigate = useNavigate();

  const loadData = useCallback(async (userId) => {
    // Sequence requests instead of Promise.all to avoid bursting the per-second rate limit.
    // Each query is independently catch-guarded so a single 429 can't crash the whole dashboard.
    const userTracks = await base44.entities.TrackSubmission
      .filter({ artist_id: userId }, "-created_date", 50)
      .catch(() => []);
    const userAssets = await base44.entities.UserAsset
      .filter({ user_id: userId }, "-created_date", 100)
      .catch(() => []);
    const logs = await base44.entities.APIUsageLog
      .filter({ user_id: userId }, "-created_date", 200)
      .catch(() => []);
    const ws = await base44.entities.Workspace
      .filter({ user_id: userId }, "-created_date", 50)
      .catch(() => []);
    setWorkspaces(ws);

    setTracks(userTracks);
    setAssets(userAssets);
    setUsageLogs(logs);
    const creditsSpent = logs.reduce((s, l) => s + (l.credits_used || 0), 0);
    const totalGenerations = logs.filter(l => l.status === 'success').length;
    setStats({
      total_tracks: userTracks.length,
      published: userTracks.filter(t => t.status === "approved").length,
      pending: userTracks.filter(t => t.status === "pending").length,
      total_plays: userTracks.reduce((s, t) => s + (t.play_count || 0), 0),
      total_likes: userTracks.reduce((s, t) => s + (t.like_count || 0), 0),
      total_assets: userAssets.length,
      credits_spent: creditsSpent,
      total_generations: totalGenerations,
    });
  }, []);

  useEffect(() => {
    // Reuse the auth context user — no duplicate auth.me() roundtrip on top of the burst.
    if (authUser === undefined) return; // still loading
    if (!authUser) { navigate("/"); return; }
    setUser(authUser);
    loadData(authUser.id).finally(() => setLoading(false));
  }, [authUser, navigate, loadData]);

  // Real-time subscription to asset changes
  useEffect(() => {
    if (!user) return;
    const unsub = base44.entities.UserAsset.subscribe((event) => {
      if (event.type === 'create' && event.data?.user_id === user.id) {
        setAssets(prev => [event.data, ...prev]);
        setStats(s => s ? { ...s, total_assets: s.total_assets + 1 } : s);
      } else if (event.type === 'delete') {
        setAssets(prev => prev.filter(a => a.id !== event.id));
        setStats(s => s ? { ...s, total_assets: Math.max(0, s.total_assets - 1) } : s);
      } else if (event.type === 'update' && event.data?.user_id === user.id) {
        setAssets(prev => prev.map(a => a.id === event.id ? event.data : a));
      }
    });
    return unsub;
  }, [user]);

  const deleteAsset = async (id) => {
    await base44.entities.UserAsset.delete(id);
    toast.success("Asset deleted");
  };

  const selectWorkspace = (id) => {
    setActiveWorkspaceId(id);
    localStorage.setItem("bs_active_workspace", id);
  };

  const assignToWorkspace = async (assetId, workspaceId) => {
    await base44.entities.UserAsset.update(assetId, { workspace_id: workspaceId });
    setAssets(prev => prev.map(a => a.id === assetId ? { ...a, workspace_id: workspaceId } : a));
    toast.success(workspaceId ? "Moved to workspace" : "Removed from workspace");
  };

  const wsAssets = activeWorkspaceId === "all"
    ? assets
    : assets.filter(a => a.workspace_id === activeWorkspaceId);

  const assetsByType = {
    all:      wsAssets,
    track:    wsAssets.filter(a => a.asset_type === "track"),
    lyric:    wsAssets.filter(a => a.asset_type === "lyric"),
    coverart: wsAssets.filter(a => a.asset_type === "coverart"),
  };

  const TABS = [
    { key: "library",   label: "Library",     icon: FolderOpen, count: assets.length, tip: "All your generated tracks, lyrics and cover art — play, download or open them in any studio" },
    { key: "loops",     label: "Loops",       icon: Music,      tip: "Your saved loops, one-shots and samples — uploaded, generated or imported from Freesound" },
    { key: "projects",  label: "Projects",    icon: Layers,     tip: "Group related assets into projects to organize bigger releases" },
    { key: "tracks",    label: "Submissions", icon: Upload, count: tracks.length, tip: "Tracks you've submitted to the community charts and radio, with their approval status" },
    { key: "live",      label: "Live",        icon: Radio,      tip: "Your live streaming sessions — past shows and stats" },
    { key: "fans",      label: "Fans",        icon: Trophy,     tip: "Fan economy — collectibles, fan club tiers, rewards and your top supporters" },
    { key: "distribution", label: "Distribution", icon: Share2, tip: "Connect your Audius account and publish tracks to the streaming network with full provenance" },
    { key: "history",   label: "History",     icon: History,    tip: "Every AI generation you've run, with status and credits used" },
    { key: "ownership", label: "Ownership",   icon: Award,      tip: "Creative Ownership Scores — how much human input went into each creation" },
    { key: "proof",     label: "Proof",       icon: ShieldCheck, tip: "Permanent, tamper-proof ownership records and downloadable certificates for your tracks" },
    { key: "analytics", label: "Analytics",   icon: BarChart3,  tip: "Usage trends — generations, credits and provider breakdowns over time" },
  ];

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#FF9A4D]/30 border-t-[#FF9A4D] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-12">
      {/* Hero */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#FF9A4D] mb-1.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF9A4D] animate-pulse" style={{ boxShadow: "0 0 8px #FF9A4D" }} />
            creator // workspace
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">My Workspace</h1>
          <p className="text-sm text-muted-foreground mt-1">Tracks · assets · projects · generation history</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CreditBalanceWidget />
          <Link to="/studios">
            <Button size="sm" className="rounded-lg gap-2 merc-button text-xs font-mono uppercase tracking-wider">
              <Music className="w-3.5 h-3.5" /> Studio Hub
            </Button>
          </Link>
          <Button onClick={() => user && loadData(user.id)} variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* XP Widget */}
      {user && <div className="mb-4"><XPWidget userId={user.id} collapsible /></div>}

      {/* Stats — collapsible circuit strip */}
      {stats && (
        <div className="mb-6">
          <WorkspaceStatsBar stats={[
            { icon: Folder,      label: "Assets",     value: stats.total_assets,                 accent: "#60a5fa", tip: "Everything in your library — tracks, lyrics, art & more" },
            { icon: Eye,         label: "Plays",      value: stats.total_plays.toLocaleString(), accent: "#FFC98A", tip: "Total plays across all your published tracks" },
            { icon: TrendingUp,  label: "Credits",    value: stats.credits_spent,                accent: "#f59e0b", tip: "Total credits spent on AI generations" },
            { icon: Zap,         label: "Generated",  value: stats.total_generations,            accent: "#22d3ee", tip: "Successful AI generations you've run" },
            { icon: Music,       label: "Submitted",  value: stats.total_tracks,                 accent: "#FF9A4D", tip: "Tracks you've submitted to the community" },
            { icon: CheckCircle, label: "Published",  value: stats.published,                    accent: "#34d399", tip: "Submissions approved and live on charts & radio" },
            { icon: Clock,       label: "Pending",    value: stats.pending,                      accent: "#fbbf24", tip: "Submissions awaiting review" },
            { icon: Heart,       label: "Likes",      value: stats.total_likes.toLocaleString(), accent: "#fb7185", tip: "Total likes from listeners" },
          ]} />
        </div>
      )}

      {/* Section nav — sidebar on desktop, scrollable rail on mobile */}
      <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-6 lg:items-start">
        <aside className="lg:sticky lg:top-6 mb-6 lg:mb-0">
          <WorkspaceSidebarNav tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
          <div className="lg:hidden">
            <CircuitTabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
          </div>
        </aside>

        <div className="min-w-0">

      {/* Asset Library Tab */}
      {activeTab === "library" && (
        <div>
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            {user && (
              <WorkspaceSwitcher
                userId={user.id}
                workspaces={workspaces}
                activeId={activeWorkspaceId}
                onSelect={selectWorkspace}
                onWorkspacesChange={setWorkspaces}
              />
            )}
            <div className="flex gap-1.5 flex-wrap">
            {[
              { key: "all",      icon: Folder,   label: `All · ${wsAssets.length}` },
              { key: "track",    icon: Music,    label: `Tracks · ${assetsByType.track.length}` },
              { key: "lyric",    icon: FileText, label: `Lyrics · ${assetsByType.lyric.length}` },
              { key: "coverart", icon: Image,    label: `Cover Art · ${assetsByType.coverart.length}` },
            ].map(({ key, icon: Icon, label }) => (
              <button key={key} onClick={() => setAssetFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-mono uppercase tracking-wider transition-all ${assetFilter === key ? "border-[#FF9A4D]/50 bg-[#FF9A4D]/10 text-[#FFC98A]" : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"}`}>
                <Icon className="w-3 h-3" /> {label}
              </button>
            ))}
            </div>
          </div>
          {(assetsByType[assetFilter] || []).length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-2xl">
              <Folder className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm">No assets yet — generate something in the studios!</p>
              <Link to="/music-studio" className="text-purple-400 text-xs hover:text-purple-300 mt-2 block">Go to Music Studio →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {(assetsByType[assetFilter] || []).map(asset => (
                <TrackCard key={asset.id} asset={asset} onDelete={deleteAsset}
                  workspaces={workspaces} onAssignWorkspace={assignToWorkspace} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loops Tab */}
      {activeTab === "loops" && user && (
        <MyLoopsTab />
      )}

      {/* Projects Tab */}
      {activeTab === "projects" && user && (
        <ProjectsTab userId={user.id} assets={assets} />
      )}

      {/* Submissions Tab */}
      {activeTab === "tracks" && (
        <SubmissionsTab tracks={tracks} />
      )}

      {/* Live Sessions Tab */}
      {activeTab === "live" && user && (
        <LiveSessionsTab userId={user.id} />
      )}

      {/* Phase 5 — Fan Economy Tab */}
      {activeTab === "fans" && user && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-black">Fan Economy</h2>
              <p className="text-sm text-muted-foreground">Manage collectibles, fan club, and rewards.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link to={`/fanclub/${user.id}`}>
                <Button variant="outline" className="rounded-xl gap-2">👑 My Fan Club</Button>
              </Link>
              <Link to={`/creator-store/${user.id}`}>
                <Button variant="outline" className="rounded-xl gap-2">🛍️ Storefront</Button>
              </Link>
              <RewardFansModal />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CollectibleManagerPanel />
            <TopFansAnalytics creatorId={user.id} />
          </div>
        </div>
      )}

      {/* Distribution Tab */}
      {activeTab === "distribution" && user && (
        <DistributionTab user={user} assets={assets} />
      )}

      {/* Generation History Tab */}
      {activeTab === "history" && user && (
        <GenerationHistoryTab userId={user.id} />
      )}

      {/* Creative Ownership Tab */}
      {activeTab === "ownership" && (
        <OwnershipDashboard items={assets} />
      )}

      {/* Proof of Ownership Tab */}
      {activeTab === "proof" && user && (
        <ProofOfOwnershipTab userId={user.id} user={user} assets={assets} />
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && user && (
        <div className="space-y-4">
          <UsageAnalytics userId={user.id} />
          <PerTrackAnalytics userId={user.id} assets={assets} />
        </div>
      )}

        </div>
      </div>
    </div>
  );
}