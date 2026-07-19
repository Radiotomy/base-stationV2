import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FORUM_CATEGORIES } from "@/components/forum/ForumCategoryBadge";

export default function NewThreadDialog({ open, onOpenChange, onSubmit, defaultCategory = "general" }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSubmit({ title, body, category });
      setTitle("");
      setBody("");
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Could not create the discussion.");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a discussion</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-2">
              {FORUM_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all ${
                    category === c.key ? c.color : "text-white/40 border-white/10 hover:border-white/30"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="thread-title">Title</Label>
            <Input
              id="thread-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you want to discuss?"
              maxLength={140}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="thread-body">Your post</Label>
            <Textarea
              id="thread-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share your thoughts on the legal terms, COS scoring, AI music policy…"
              rows={6}
              maxLength={5000}
              required
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={saving || title.trim().length < 4 || body.trim().length < 2} className="w-full">
            {saving ? "Posting…" : "Post discussion"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}