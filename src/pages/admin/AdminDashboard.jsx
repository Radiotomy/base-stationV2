import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Music, Users, Trophy, Star, Shield,
  TrendingUp, ChevronRight, Menu, X, LogOut, Zap, Wallet, UserCog, Megaphone, FlaskConical,
  Flag, Bug, Activity, Radio
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "Users", icon: UserCog },
  { to: "/admin/moderation", label: "Moderation", icon: Flag },
  { to: "/admin/tracks", label: "Tracks", icon: Music },
  { to: "/admin/artists", label: "Artists", icon: Users },
  { to: "/admin/challenges", label: "Challenges", icon: Trophy },
  { to: "/admin/featured", label: "Featured", icon: Star },
  { to: "/admin/analytics", label: "Analytics", icon: TrendingUp },
  { to: "/admin/ai-integrations", label: "AI Integrations", icon: Zap },
  { to: "/admin/marketing", label: "Marketing", icon: Megaphone },
  { to: "/admin/benchmarks", label: "BASE Mark Benchmarks", icon: FlaskConical },
  { to: "/admin/solana", label: "Solana Registry", icon: Shield },
  { to: "/admin/blockchain-wallets", label: "Blockchain Wallets", icon: Wallet },
];

// Admin-gated engineering tools that live outside the /admin router.
const DEV_NAV = [
  { to: "/dev/smoke-tests", label: "Smoke Tests", icon: FlaskConical },
  { to: "/dev/error-log", label: "Error Log", icon: Bug },
  { to: "/dev/live-regression", label: "Live Regression", icon: Activity },
  { to: "/dev/live-multiclient", label: "Live Multiclient", icon: Radio },
];

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me()
      .then(u => {
        if (u?.role !== "admin") { navigate("/"); return; }
        setUser(u);
        setLoading(false);
      })
      .catch(() => navigate("/"));
  }, []);

  const isActive = (to, exact) => exact ? location.pathname === to : location.pathname.startsWith(to) && (exact || to !== "/admin" || location.pathname === "/admin");

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-card border-r border-border flex flex-col transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:flex`}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <Link to="/" className="font-black text-lg">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Base</span>
            <span className="text-foreground">Station</span>
            <span className="text-muted-foreground font-normal text-xs ml-1.5">Admin</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, exact }) => (
            <Link key={to} to={to} onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive(to, exact) ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}

          <p className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Dev Tools</p>
          {DEV_NAV.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${location.pathname === to ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-400">
              {(user?.full_name || "A")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{user?.full_name || "Admin"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Link to="/">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground rounded-xl text-xs">
              <LogOut className="w-3.5 h-3.5" /> Back to Site
            </Button>
          </Link>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="lg:hidden sticky top-0 z-30 bg-card border-b border-border flex items-center gap-3 px-4 h-14">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-black text-sm">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Base</span>
            <span className="text-foreground">Station</span> Admin
          </span>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}