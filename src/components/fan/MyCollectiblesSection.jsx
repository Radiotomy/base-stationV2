import { Link } from "react-router-dom";
import { Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const SOURCE_LABELS = {
  free: "Free Claim", quest: "Quest Reward", purchase: "Purchased",
  live_drop: "Live Drop", reward: "Creator Reward",
};

export default function MyCollectiblesSection({ claims, creatorMap }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Award className="w-4 h-4 text-blue-400" />
        <h3 className="font-black text-sm">My Collectibles</h3>
        <span className="text-xs text-muted-foreground ml-auto">{claims.length}</span>
      </div>
      {claims.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No collectibles yet — claim them during live sessions or on artist profiles.
        </p>
      ) : (
        <div className="space-y-2">
          {claims.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Award className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">
                  {SOURCE_LABELS[c.claim_source] || "Collectible"}
                  {c.serial_number != null && <span className="text-muted-foreground font-normal"> · #{c.serial_number}</span>}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {creatorMap[c.creator_id] ? (
                    <Link to={`/artist/${c.creator_id}`} className="hover:text-[#FFC98A]">
                      from {creatorMap[c.creator_id]}
                    </Link>
                  ) : "from creator"}
                  {c.created_date && ` · ${format(new Date(c.claimed_at || c.created_date), "MMM d, yyyy")}`}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] capitalize flex-shrink-0">{c.claim_source}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}