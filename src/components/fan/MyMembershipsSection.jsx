import { Link } from "react-router-dom";
import { Crown, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MyMembershipsSection({ memberships, creatorMap }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Crown className="w-4 h-4 text-yellow-400" />
        <h3 className="font-black text-sm">Fan Club Memberships</h3>
        <span className="text-xs text-muted-foreground ml-auto">{memberships.length}</span>
      </div>
      {memberships.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          You haven't joined any fan clubs yet — visit an artist's profile to join theirs.
        </p>
      ) : (
        <div className="space-y-2">
          {memberships.map(m => (
            <Link key={m.id} to={`/fanclub/${m.creator_id}`}
              className="flex items-center gap-3 p-3 rounded-xl border border-border/60 hover:border-yellow-500/40 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <Crown className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">
                  {creatorMap[m.creator_id] ? `${creatorMap[m.creator_id]}'s Fan Club` : "Fan Club"}
                </p>
                <p className="text-[11px] text-muted-foreground">{m.tier_name}</p>
              </div>
              {(m.xp_multiplier || 1) > 1 && (
                <Badge className="bg-emerald-500/20 text-emerald-300 border-0 gap-1 flex-shrink-0">
                  <Sparkles className="w-3 h-3" /> {m.xp_multiplier}× XP
                </Badge>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}