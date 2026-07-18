import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu, X, Home, Radio, TrendingUp, Music, Star, Zap, Globe,
  LogOut, User, BarChart3, Mic2, Film, Upload, Settings, HelpCircle, Newspaper
} from "lucide-react";
// Note: Icon alias warnings from destructured props are false positives — ignore them.
import { Button } from "@/components/ui/button";
import CreditBalanceWidget from "@/components/credits/CreditBalanceWidget";
import JobNotificationBell from "@/components/notifications/JobNotificationBell";
import NavDropdown from "@/components/layout/NavDropdown";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/radio", label: "Radio", icon: Radio },
  { to: "/charts", label: "Charts", icon: TrendingUp },
  { to: "/playlists", label: "Playlists", icon: Music },
  { to: "/challenges", label: "Challenges", icon: Zap },
  { to: "/leaderboard", label: "Leaderboard", icon: Star },
  { to: "/news-hub", label: "News & Legal", icon: Newspaper },
  // Multi-Chain nav hidden for now — restore when blockchain features return:
  // { to: "/blockchain", label: "Multi-Chain", icon: Globe },
];

// Desktop grouped nav — Home stays direct, the rest collapse into two dropdowns
const DISCOVER_NAV = [
  { to: "/radio", label: "Radio", icon: Radio },
  { to: "/charts", label: "Charts", icon: TrendingUp },
  { to: "/playlists", label: "Playlists", icon: Music },
  { to: "/news-hub", label: "News & Legal", icon: Newspaper },
];

const COMMUNITY_NAV = [
  { to: "/challenges", label: "Challenges", icon: Zap },
  { to: "/leaderboard", label: "Leaderboard", icon: Star },
];

const CREATOR_NAV = [
  { to: "/studios", label: "Studios", icon: Music },
  { to: "/creator-dashboard", label: "My Workspace", icon: BarChart3 },
  { to: "/submit", label: "Submit Track", icon: Upload },
];

export default function Header({ user }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();
  const isCreator = user?.is_creator || false;

  return (
    <header
      className="sticky top-0 z-40 border-b-2 border-black"
      style={{
        background: "linear-gradient(180deg, #221B14 0%, #16110D 60%, #0F0C09 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 20px rgba(0,0,0,0.7)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="font-display text-xl tracking-tight flex-shrink-0 flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full bg-[#FF5A1F] flex-shrink-0"
            style={{ boxShadow: "0 0 8px rgba(255,90,30,0.9), 0 0 18px rgba(255,90,30,0.5)" }}
          />
          <span>
            <span
              className="text-[#FF9A4D]"
              style={{ textShadow: "0 0 10px rgba(255,154,77,0.5)" }}
            >
              Base
            </span>
            <span className="text-[#E8E0D0]">Station</span>
          </span>
        </Link>

        {/* Desktop Nav — grouped into dropdowns to stay uncrowded */}
        <nav className="hidden lg:flex items-center gap-1">
          <Link
            to="/"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border transition-all ${
              location.pathname === "/"
                ? "text-[#1F3A0E] border-black shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
                : "text-white/60 border-black/60 bg-gradient-to-b from-[#28211A] to-[#171310] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:text-[#FF9A4D] hover:border-[#FF9A4D]/40"
            }`}
            style={location.pathname === "/" ? { background: "linear-gradient(180deg, #C8EF92 0%, #A9DC66 100%)" } : undefined}
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
          <NavDropdown label="Discover" icon={Globe} items={DISCOVER_NAV} currentPath={location.pathname} />
          <NavDropdown label="Community" icon={Star} items={COMMUNITY_NAV} currentPath={location.pathname} />
          {isCreator && (
            <>
              <div className="w-px h-6 bg-black shadow-[1px_0_0_rgba(255,255,255,0.08)] mx-1" />
              {CREATOR_NAV.slice(0, 2).map(({ to, label, icon: Icon }) => {
                const isActive = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border transition-all ${
                      isActive
                        ? "text-[#1F3A0E] border-black shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
                        : "text-white/60 border-black/60 bg-gradient-to-b from-[#28211A] to-[#171310] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:text-[#FF9A4D] hover:border-[#FF9A4D]/40"
                    }`}
                    style={isActive ? { background: "linear-gradient(180deg, #C8EF92 0%, #A9DC66 100%)" } : undefined}
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
          <Link
            to="/help"
            title="Help & How-To"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold text-white/60 border border-black/60 bg-gradient-to-b from-[#28211A] to-[#171310] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:text-[#FF9A4D] hover:border-[#FF9A4D]/40 transition-all"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden md:inline">Help</span>
          </Link>
          {user && <JobNotificationBell />}
          {user && <CreditBalanceWidget />}
          {user && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-[#2A1508] border border-black/70 hover:scale-105 transition-all"
                style={{
                  background: "radial-gradient(circle at 35% 30%, #FFC98A 0%, #FF9A4D 45%, #B05018 100%)",
                  boxShadow: "0 0 12px rgba(255,154,77,0.4), inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -3px 5px rgba(120,50,10,0.5)",
                }}
              >
                {(user.full_name || "U")[0].toUpperCase()}
              </button>

              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 mt-2 w-48 rounded-lg overflow-hidden border-2 border-black bg-gradient-to-b from-[#221B14] to-[#0F0C09] shadow-[0_12px_36px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.08)]"
                  >
                    <div className="p-3 border-b border-black shadow-[0_1px_0_rgba(255,255,255,0.06)]">
                      <p className="text-sm font-bold text-white truncate">{user.full_name}</p>
                      <p className="text-xs text-white/50 truncate">{user.email}</p>
                    </div>
                    <div className="space-y-1 p-2">
                      <Link
                        to="/my-profile"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all"
                      >
                        <User className="w-4 h-4" /> My Profile
                      </Link>
                      <Link
                        to="/credits"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all"
                      >
                        <Zap className="w-4 h-4" /> Credits & Plans
                      </Link>
                      {isCreator && (
                        <Link
                          to="/creator-dashboard"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all"
                        >
                          <BarChart3 className="w-4 h-4" /> Studio Dashboard
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          base44.auth.logout("/");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-destructive hover:bg-destructive/10 transition-all"
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
            className="lg:hidden w-9 h-9 rounded-md flex items-center justify-center text-white/70 border border-black/60 bg-gradient-to-b from-[#28211A] to-[#171310] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:text-[#FF9A4D] hover:border-[#FF9A4D]/40 transition-all"
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
            className="lg:hidden border-t-2 border-black"
            style={{ background: "linear-gradient(180deg, #1A1410 0%, #0F0C09 100%)" }}
          >
            <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold text-white/70 border border-black/60 bg-gradient-to-b from-[#28211A] to-[#171310] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:text-[#FF9A4D] hover:border-[#FF9A4D]/40 transition-all"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
              {isCreator && (
                <>
                  <div className="my-2 border-t border-black shadow-[0_1px_0_rgba(255,255,255,0.06)]" />
                  {CREATOR_NAV.map(({ to, label, icon: Icon }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold text-white/70 border border-black/60 bg-gradient-to-b from-[#28211A] to-[#171310] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:text-[#FF9A4D] hover:border-[#FF9A4D]/40 transition-all"
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