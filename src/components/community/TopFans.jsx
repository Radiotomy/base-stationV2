import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Heart, Star, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function TopFans({ artistId }) {
  const [fans, setFans] = useState([]);

  useEffect(() => {
    if (!artistId) return;
    // Top fans = followers with XP, sorted by total_xp
    Promise.all([
      base44.entities.Follow.filter({ target_user_id: artistId }, "-created_date", 20),
    ]).then(async ([follows]) => {
      const fanIds = follows.map(f => f.follower_id).slice(0, 8);
      if (!fanIds.length) { setFans([]); return; }
      const xpData = await Promise.all(
        fanIds.map(uid => base44.entities.UserXP.filter({ user_id: uid }).then(r => r[0]).catch(() => null))
      );
      const merged = follows.slice(0, 8).map((f, i) => ({
        ...f,
        xp: xpData[i],
      })).sort((a, b) => (b.xp?.total_xp || 0) - (a.xp?.total_xp || 0));
      setFans(merged);
    }).catch(() => {});
  }, [artistId]);

  if (!fans.length) return null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-black text-foreground mb-4 flex items-center gap-2">
        <Heart className="w-4 h-4 text-pink-400" /> Top Fans
      </h2>
      <div className="flex flex-wrap gap-3">
        {fans.map((fan, i) => {
          const level = fan.xp ? Math.min(10, Math.floor(Math.sqrt((fan.xp.total_xp || 0) / 100)) + 1) : 1;
          const name = fan.follower_name || "Listener";
          return (
            <div key={fan.id} className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-xs font-black text-white">
                  {name[0].toUpperCase()}
                </div>
                {i === 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center">
                    <Star className="w-2.5 h-2.5 text-yellow-900 fill-yellow-900" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-foreground leading-none">{name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Zap className="w-2.5 h-2.5 text-yellow-400" />
                  <span className="text-xs text-muted-foreground">Lvl {level}</span>
                  {fan.xp?.total_xp > 0 && <span className="text-xs text-yellow-400">{(fan.xp.total_xp).toLocaleString()} XP</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}