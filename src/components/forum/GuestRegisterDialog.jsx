import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function GuestRegisterDialog({ open, onOpenChange, onRegister }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onRegister(name, email);
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Registration failed. Try again.");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Join the forum</DialogTitle>
          <DialogDescription>
            Quick, standalone forum profile — no BASE Station account needed. Just pick a display name.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="forum-name">Display name</Label>
            <Input
              id="forum-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. IndieProducer42"
              maxLength={40}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="forum-email">Email <span className="text-muted-foreground">(optional, never shown)</span></Label>
            <Input
              id="forum-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={saving || name.trim().length < 2} className="w-full">
            {saving ? "Creating profile…" : "Start posting"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}