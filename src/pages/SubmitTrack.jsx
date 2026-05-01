import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Upload, Music, Link as LinkIcon, CheckCircle, Sparkles, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const GENRES = ["hip-hop","edm","pop","r&b","rock","lo-fi","jazz","classical","trap","other"];
const AI_TOOLS = ["Suno", "Udio", "ElevenLabs", "Riffusion", "Mureka", "Beatoven", "Aiva", "Soundraw", "Multiple", "Other"];

export default function SubmitTrack() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", track_url: "", cover_image_url: "",
    genre: "", ai_tools_used: "", tags: "", lyrics: "", bpm: ""
  });

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.track_url) { toast.error("Title and track URL are required"); return; }
    if (!user) { toast.error("You must be signed in to submit"); return; }
    setSubmitting(true);

    const tagsArr = form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [];

    await base44.entities.TrackSubmission.create({
      ...form,
      tags: tagsArr,
      bpm: form.bpm ? parseInt(form.bpm) : undefined,
      artist_id: user.id,
      artist_name: user.full_name,
      artist_email: user.email,
      play_count: 0,
      like_count: 0,
      status: "pending",
    });

    // Activity feed
    base44.entities.ActivityFeedItem.create({
      type: "track_submitted",
      actor_name: user.full_name,
      actor_id: user.id,
      title: `submitted a new track: "${form.title}"`,
      description: form.genre || "",
    }).catch(() => {});

    setSubmitted(true);
    setSubmitting(false);
    toast.success("Track submitted! We'll review it shortly.");
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <Music className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
        <h2 className="text-2xl font-black text-foreground mb-2">Sign In Required</h2>
        <p className="text-muted-foreground mb-6">You need to be signed in to submit tracks to Base Station.</p>
        <Button onClick={() => base44.auth.redirectToLogin(window.location.href)} className="rounded-full bg-purple-600 hover:bg-purple-500 text-white px-8">
          Sign In to Submit
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-950 via-emerald-900 to-cyan-950 pt-20 pb-16 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-emerald-500/20 via-transparent to-transparent" />
        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <Badge className="mb-4 bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-4 py-1.5 text-xs tracking-widest uppercase">
              🎵 Submit Your Track
            </Badge>
            <h1 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tight">
              Share Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Music</span>
            </h1>
            <p className="text-emerald-200/70 text-lg max-w-xl mx-auto">
              Submit your AI-generated track to Base Station. Get on the charts, enter challenges, and build your fanbase.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {submitted ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-black text-foreground mb-3">Track Submitted! 🎉</h2>
            <p className="text-muted-foreground mb-8 text-lg">Your track is under review. You'll see it live on the platform once approved.</p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button onClick={() => { setSubmitted(false); setForm({ title: "", description: "", track_url: "", cover_image_url: "", genre: "", ai_tools_used: "", tags: "", lyrics: "", bpm: "" }); }}
                variant="outline" className="rounded-full px-8">Submit Another</Button>
              <Link to="/challenges">
                <Button className="rounded-full px-8 bg-purple-600 hover:bg-purple-500">Enter a Challenge <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </Link>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
              <h3 className="font-black text-foreground text-lg flex items-center gap-2"><Music className="w-5 h-5 text-purple-400" /> Track Info</h3>
              <div className="space-y-2">
                <Label>Track Title *</Label>
                <Input value={form.title} onChange={e => update("title", e.target.value)} placeholder="Your track name" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => update("description", e.target.value)} placeholder="Tell the community about your track — inspiration, process, vibes..." rows={3} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Genre</Label>
                  <Select onValueChange={v => update("genre", v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select genre" /></SelectTrigger>
                    <SelectContent>{GENRES.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>AI Tool Used</Label>
                  <Select onValueChange={v => update("ai_tools_used", v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Primary tool" /></SelectTrigger>
                    <SelectContent>{AI_TOOLS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>BPM <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input type="number" value={form.bpm} onChange={e => update("bpm", e.target.value)} placeholder="e.g. 128" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Tags <span className="text-muted-foreground text-xs">(comma-separated)</span></Label>
                  <Input value={form.tags} onChange={e => update("tags", e.target.value)} placeholder="vibe, dark, summer..." className="rounded-xl" />
                </div>
              </div>
            </div>

            {/* Links */}
            <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
              <h3 className="font-black text-foreground text-lg flex items-center gap-2"><LinkIcon className="w-5 h-5 text-emerald-400" /> Track Links</h3>
              <div className="space-y-2">
                <Label>Track URL * <span className="text-muted-foreground text-xs">(SoundCloud, YouTube, Suno, Udio, etc.)</span></Label>
                <Input value={form.track_url} onChange={e => update("track_url", e.target.value)} placeholder="https://soundcloud.com/your-track" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Cover Image URL <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input value={form.cover_image_url} onChange={e => update("cover_image_url", e.target.value)} placeholder="https://..." className="rounded-xl" />
                {form.cover_image_url && (
                  <div className="w-24 h-24 rounded-xl overflow-hidden border border-border">
                    <img src={form.cover_image_url} alt="Preview" className="w-full h-full object-cover" onError={e => e.target.style.display = "none"} />
                  </div>
                )}
              </div>
            </div>

            {/* Lyrics */}
            <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-foreground text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-pink-400" /> Lyrics</h3>
                <Link to="/ai-studio" className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1">
                  Generate with AI <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <Textarea value={form.lyrics} onChange={e => update("lyrics", e.target.value)} placeholder="Paste your lyrics here (optional)..." rows={5} className="rounded-xl font-mono text-sm" />
            </div>

            <Button type="submit" disabled={submitting}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-base">
              {submitting ? "Submitting…" : <><Upload className="w-5 h-5 mr-2" /> Submit Track</>}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}