import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, Loader2, GitFork, Sliders } from "lucide-react";
import { resolveForkLineage } from "@/lib/foundry/forkLineage";

// Patch-design challenge entry: the creator picks one of their own Foundry
// patches. No track URL — a patch challenge judges the graph, not a recording.
export default function SubmitPatchChallengeModal({ challenge, user, onClose, onSubmitted }) {
  const [patches, setPatches] = useState(null);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    base44.entities.FoundryPlugin
      .filter({ user_id: user.id }, "-created_date", 60)
      .then(setPatches)
      .catch(() => setPatches([]));
  }, [user?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) { toast.error("Pick a patch to enter"); return; }
    setSubmitting(true);
    try {
      const lineage = await resolveForkLineage(selected);

      await base44.entities.ChallengeSubmission.create({
        challenge_id: challenge.id,
        challenge_title: challenge.title,
        challenge_category: "patch_design",
        artist_name: user.full_name,
        artist_id: user.id,
        track_title: selected.title,
        description: notes,
        plugin_id: selected.id,
        plugin_human_score: selected.human_score ?? 0,
        ...lineage,
        vote_count: 0,
        play_count: 0,
        status: "pending",
      });

      // Entering publishes the patch — judges and voters have to be able to open it.
      if (!selected.is_public) {
        await base44.entities.FoundryPlugin.update(selected.id, { is_public: true }).catch(() => {});
      }

      base44.entities.ActivityFeedItem.create({
        type: "track_submitted",
        actor_name: user.full_name,
        actor_id: user.id,
        title: `entered the "${challenge.title}" patch challenge`,
        description: selected.title,
      }).catch(() => {});

      toast.success("Patch entered! Good luck 🎛️");
      onSubmitted();
    } catch (err) {
      toast.error(err.message || "Could not enter patch");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">Enter patch: {challenge.title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Your Patch *</Label>
            {patches === null && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading your patches…
              </div>
            )}
            {patches && !patches.length && (
              <p className="text-xs text-muted-foreground py-3">
                You haven't built a patch yet — design one in the Foundry, then enter it here.
              </p>
            )}
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {(patches || []).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                    selected?.id === p.id
                      ? "border-[#FF9A4D] bg-[#FF9A4D]/10"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 opacity-60" />
                      {p.title}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.fork_parent_id && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <GitFork className="w-2.5 h-2.5" /> fork
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {p.human_score ?? 0} design
                      </Badge>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{p.category}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Design Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What were you going for, and how did you build it?"
              rows={3}
              className="rounded-xl"
            />
          </div>

          {selected?.fork_parent_id && (
            <p className="text-[11px] text-muted-foreground">
              This patch is a fork — its lineage will be shown alongside your entry.
            </p>
          )}

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={submitting || !selected}
              className="flex-1 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold"
            >
              {submitting ? "Entering…" : <><Send className="w-4 h-4 mr-2" />Enter Patch</>}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}