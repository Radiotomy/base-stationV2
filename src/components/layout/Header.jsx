import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu, X, Home, Radio, TrendingUp, Music, Star, Zap, Globe,
  LogOut, User, BarChart3, Mic2, Film, Upload, Settings
} from "lucide-react";
// Note: Icon alias warnings from destructured props are false positives — ignore them.
import { Button } from "@/components/ui/button";
import CreditBalanceWidget from "@/components/credits/CreditBalanceWidget";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/radio", label: "Radio", icon: Radio },
  { to: "/charts", label: "Charts", icon: TrendingUp },
  { to: "/playlists", label: "Playlists", icon: Music },
  { to: "/challenges", label: "Challenges", icon: Zap },
  { to: "/leaderboard", label: "Leaderboard", icon: Star },
  { to: "/blockchain", label: "Multi-Chain", icon: Globe },
];

const CREATOR_NAV = [
  { to: "/creator-dashboard", label: "My Studio", icon: BarChart3 },
  { to: "/music-studio", label: "Create Music", icon: Music },
  { to: "/lyrics-studio", label: "Write Lyrics", icon: Mic2 },
  { to: "/video-studio", label: "Make Videos", icon: Film },
  { to: "/submit", label: "Submit Track", icon: Upload },
];

export default function Header({ user }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();
  const isCreator = user?.is_creator || false;

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="font-black text-xl tracking-tight flex-shrink-0">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Base</span>
          <span className="text-foreground">Station</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-purple-500/20 text-purple-300"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
          {isCreator && (
            <>
              <div className="w-px h-6 bg-border mx-1" />
              {CREATOR_NAV.slice(0, 2).map(({ to, label, icon: Icon }) => {
                const isActive = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          {user && <CreditBalanceWidget />}
          {user && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-400 hover:bg-purple-500/30 transition-all"
              >
                {(user.full_name || "U")[0].toUpperCase()}
              </button>

              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 mt-2 w-48 bg-card rounded-2xl border border-border shadow-xl overflow-hidden"
                  >
                    <div className="p-3 border-b border-border">
                      <p className="text-sm font-bold text-foreground truncate">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="space-y-1 p-2">
                      <Link
                        to="/my-profile"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
                      >
                        <User className="w-4 h-4" /> My Profile
                      </Link>
                      <Link
                        to="/credits"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-yellow-400 hover:bg-yellow-500/10 transition-all"
                      >
                        <Zap className="w-4 h-4" /> Credits & Plans
                      </Link>
                      {isCreator && (
                        <Link
                          to="/creator-dashboard"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-emerald-400 hover:bg-emerald-500/10 transition-all"
                        >
                          <BarChart3 className="w-4 h-4" /> Studio Dashboard
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          base44.auth.logout("/");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      >
                        <LogOut className="w-4 h-4" /> Logout
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-border bg-card/50"
          >
            <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
              {isCreator && (
                <>
                  <div className="my-2 border-t border-border" />
                  {CREATOR_NAV.map(({ to, label, icon: Icon }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-emerald-400 hover:bg-emerald-500/10 transition-all"
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </Link>
                  ))}
                </>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}