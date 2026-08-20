import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitFork, Trophy, Sparkles } from "lucide-react";

// Patch-design leaderboard: ranks entries by votes and shows fork lineage
// openly, so a forked entry gets credit without being mistaken for an original.
export default function PatchLineageLeaderboard() {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    base44.entities.ChallengeSubmission
      .filter({ challenge_category: "patch_design" }, "-vote_count", 25)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  if (entries === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading patch leaderboard…
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
        <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">No patch entries yet</p>
        <p className="text-xs mt-1">Enter a Foundry patch and it appears here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-[#FF9A4D]" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Patch Design Leaderboard
        </h2>
      </div>

      {entries.map((e, i) => (
        <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
          <span className="w-7 text-center text-sm font-black text-muted-foreground">{i + 1}</span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {e.plugin_id ? (
                <Link to={`/foundry/${e.plugin_id}`} className="text-sm font-semibold truncate hover:underline">
                  {e.track_title}
                </Link>
              ) : (
                <span className="text-sm font-semibold truncate">{e.track_title}</span>
              )}
              {e.fork_depth > 0 && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <GitFork className="w-2.5 h-2.5" />
                  fork · depth {e.fork_depth}
                </Badge>
              )}
              {e.status === "winner" && (
                <Badge className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/30">winner</Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {e.artist_name}
              {e.fork_parent_title && <> · forked from {e.fork_parent_title}</>}
            </p>
          </div>

          <div className="text-right shrink-0">
            <p className="text-sm font-bold">{e.vote_count || 0}</p>
            <p className="text-[10px] text-muted-foreground">votes</p>
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {e.plugin_human_score ?? 0} design
          </Badge>
        </div>
      ))}
    </div>
  );
}