import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const GENRES = ["all", "hip-hop", "edm", "pop", "r&b", "rock", "lo-fi", "jazz", "trap", "other"];

export default function CreatePlaylistModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: "", description: "", genre: "all", is_public: true });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error("Please enter a playlist title"); return; }
    setSaving(true);
    const user = await base44.auth.me();
    await base44.entities.Playlist.create({
      ...form,
      owner_name: user.full_name,
      track_count: 0,
      play_count: 0,
      like_count: 0,
    });
    toast.success("Playlist created!");
    onCreated?.();
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">Create Playlist</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Playlist Name *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="My Awesome Mix" className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What's this playlist about?" rows={2} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Genre</Label>
            <Select onValueChange={v => setForm(f => ({ ...f, genre: v }))} defaultValue="all">
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{GENRES.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
            <div>
              <p className="font-medium text-sm">Public Playlist</p>
              <p className="text-xs text-muted-foreground">Anyone can discover and listen</p>
            </div>
            <Switch checked={form.is_public} onCheckedChange={v => setForm(f => ({ ...f, is_public: v }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleCreate} disabled={saving} className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-500">
              {saving ? "Creating…" : "Create Playlist"}
            </Button>
            <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}