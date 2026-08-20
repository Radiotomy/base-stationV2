import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Plus, Pencil, Trash2, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const STATUS_STYLE = {
  active: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  voting: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  upcoming: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const EMPTY = { title: "", description: "", type: "weekly", category: "music", genre: "", prompt: "", prize_description: "", start_date: "", end_date: "", status: "upcoming", emoji: "🏆" };

export default function AdminChallenges() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.Challenge.list("-created_date", 50);
    setChallenges(data);
    setLoading(false);
  };

  const openCreate = () => { setForm(EMPTY); setEditing("new"); };
  const openEdit = (c) => { setForm({ ...c }); setEditing(c.id); };
  const closeEdit = () => { setEditing(null); setForm(EMPTY); };

  const save = async () => {
    if (!form.title) { toast.error("Title is required"); return; }
    setSaving(true);
    if (editing === "new") {
      const created = await base44.entities.Challenge.create(form);
      setChallenges(prev => [created, ...prev]);
      toast.success("Challenge created!");
    } else {
      await base44.entities.Challenge.update(editing, form);
      setChallenges(prev => prev.map(c => c.id === editing ? { ...c, ...form } : c));
      toast.success("Challenge updated!");
    }
    setSaving(false);
    closeEdit();
  };

  const remove = async (id) => {
    if (!confirm("Delete this challenge?")) return;
    await base44.entities.Challenge.delete(id);
    setChallenges(prev => prev.filter(c => c.id !== id));
    toast.success("Deleted");
  };

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-foreground mb-1">Challenges</h1>
          <p className="text-muted-foreground text-sm">Create and manage creator challenges</p>
        </div>
        <Button onClick={openCreate} className="rounded-xl bg-purple-600 hover:bg-purple-500 gap-2">
          <Plus className="w-4 h-4" /> New Challenge
        </Button>
      </div>

      {/* Form */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-8 p-6 rounded-2xl bg-card border border-purple-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-foreground">{editing === "new" ? "Create Challenge" : "Edit Challenge"}</h3>
              <button onClick={closeEdit} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => upd("title", e.target.value)} placeholder="Challenge name" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Emoji</Label>
                <Input value={form.emoji} onChange={e => upd("emoji", e.target.value)} placeholder="🏆" className="rounded-xl" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => upd("description", e.target.value)} rows={2} className="rounded-xl" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Creative Prompt</Label>
                <Textarea value={form.prompt} onChange={e => upd("prompt", e.target.value)} placeholder="What should artists create?" rows={2} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => upd("type", v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="special">Special</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category || "music"} onValueChange={v => upd("category", v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="music">🎵 Music — track entries</SelectItem>
                    <SelectItem value="patch_design">🎛️ Patch Design — Foundry patches</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => upd("status", v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="voting">Voting</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => upd("start_date", e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={e => upd("end_date", e.target.value)} className="rounded-xl" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Prize Description</Label>
                <Input value={form.prize_description} onChange={e => upd("prize_description", e.target.value)} placeholder="e.g. Featured on homepage + 500 XP" className="rounded-xl" />
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={save} disabled={saving} className="rounded-xl bg-purple-600 hover:bg-purple-500 gap-2">
                <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Challenge"}
              </Button>
              <Button variant="outline" onClick={closeEdit} className="rounded-xl">Cancel</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {challenges.map(c => (
            <div key={c.id} className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-purple-500/20 transition-all">
              <span className="text-2xl flex-shrink-0">{c.emoji || "🏆"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="font-bold text-foreground">{c.title}</p>
                  <Badge className={`text-xs ${STATUS_STYLE[c.status]}`}>{c.status}</Badge>
                  <Badge variant="outline" className="text-xs capitalize">{c.type}</Badge>
                  {c.category === "patch_design" && (
                    <Badge variant="outline" className="text-xs">🎛️ Patch Design</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground">{c.submission_count || 0} entries</span>
                <Button size="sm" variant="ghost" onClick={() => openEdit(c)} className="h-8 w-8 p-0 rounded-xl">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(c.id)} className="h-8 w-8 p-0 rounded-xl text-destructive hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}