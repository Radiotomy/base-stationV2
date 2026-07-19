import { Link } from "react-router-dom";
import { Heart, Mic2, Radio, TrendingUp, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import MyCreatorActions from "@/components/fan/MyCreatorActions";

export default function FanProfileView({ user, onBecomeCreator }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="relative h-40 bg-gradient-to-br from-purple-900 via-indigo-900 to-pink-900">
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>
      <div className="max-w-3xl mx-auto px-6 -mt-14 relative z-10 pb-16">
        <div className="flex items-end gap-4 mb-8">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-pink-600 to-purple-600 border-4 border-background shadow-2xl flex items-center justify-center flex-shrink-0">
            <span className="text-3xl font-black text-white">{(user?.full_name || "?")[0].toUpperCase()}</span>
          </div>
          <div className="flex-1 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-black text-foreground">{user?.full_name}</h1>
              <Badge className="bg-pink-500/20 text-pink-300 border-0 gap-1"><Heart className="w-3 h-3" /> Fan</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{user?.email}</p>
          </div>
        </div>

        {/* Fan quick links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { to: "/fan-hub", label: "My Fan Hub", icon: Heart },
            { to: "/featured-artists", label: "Discover Artists", icon: Star },
            { to: "/radio", label: "Radio", icon: Radio },
            { to: "/charts", label: "Charts", icon: TrendingUp },
          ].map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to}
              className="rounded-2xl border border-border bg-card p-4 text-center hover:border-pink-500/40 transition-colors">
              <Icon className="w-5 h-5 mx-auto mb-1.5 text-pink-400" />
              <p className="text-xs font-bold text-foreground">{label}</p>
            </Link>
          ))}
        </div>

        {/* Support history */}
        {user && <div className="mb-8"><MyCreatorActions userId={user.id} /></div>}

        {/* Become a creator */}
        <div className="rounded-2xl border border-[#FF9A4D]/30 bg-[#FF9A4D]/5 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="font-black text-foreground mb-1 flex items-center gap-2">
              <Mic2 className="w-4 h-4 text-[#FF9A4D]" /> Ready to make music?
            </h3>
            <p className="text-xs text-muted-foreground">
              Set up an artist profile to unlock the AI studios, track submissions, and live streaming.
            </p>
          </div>
          <Button onClick={onBecomeCreator} className="rounded-xl merc-button font-bold flex-shrink-0">
            Become a Creator
          </Button>
        </div>
      </div>
    </div>
  );
}