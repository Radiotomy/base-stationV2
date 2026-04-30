import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Send } from "lucide-react";

export default function SubmitChallengeModal({ challenge, user, onClose, onSubmitted }) {
  const [form, setForm] = useState({ track_title: "", track_url: "", description: "", ai_tools_used: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.track_title || !form.track_url) { toast.error("Track title and URL are required"); return; }
    setSubmitting(true);
    await base44.entities.ChallengeSubmission.create({
      ...form,
      challenge_id: challenge.id,
      challenge_title: challenge.title,
      artist_name: user.full_name,
      artist_id: user.id,
      vote_count: 0,
      play_count: 0,
      status: "pending",
    });
    // Log to activity feed
    base44.entities.ActivityFeedItem.create({
      type: "track_submitted",
      actor_name: user.full_name,
      actor_id: user.id,
      title: `entered the "${challenge.title}" challenge`,
      description: form.track_title,
    }).catch(() => {});
    toast.success("Entry submitted! Good luck 🎵");
    onSubmitted();
  };

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">Submit to: {challenge.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Track Title *</Label>
            <Input value={form.track_title} onChange={e => update("track_title", e.target.value)} placeholder="Your track name" className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Track URL * <span className="text-muted-foreground text-xs">(SoundCloud, YouTube, Suno, etc.)</span></Label>
            <Input value={form.track_url} onChange={e => update("track_url", e.target.value)} placeholder="https://..." className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>AI Tools Used</Label>
            <Input value={form.ai_tools_used} onChange={e => update("ai_tools_used", e.target.value)} placeholder="Suno, Udio, ElevenLabs..." className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => update("description", e.target.value)} placeholder="Tell us about your creative process..." rows={3} className="rounded-xl" />
          </div>
          <div className="flex gap-3">
            <Button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold">
              {submitting ? "Submitting…" : <><Send className="w-4 h-4 mr-2" />Submit Entry</>}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}