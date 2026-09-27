import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { motion } from "framer-motion";
import { Star, Music, Users, Check, Send, ArrowRight, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const SELECT_CLS = "flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-sm capitalize shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const GENRES = ["hip-hop", "edm", "pop", "r&b", "rock", "lo-fi", "jazz", "trap", "other"];
const AI_TOOLS = ["Suno", "Udio", "ElevenLabs", "Riffusion", "Mureka", "Multiple tools"];

export default function FeaturedArtists() {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    artist_name: "", email: "", bio: "", genre: "", sample_track_url: "",
    social_links: "", why_featured: "", monthly_listeners: "", ai_tools_used: ""
  });

  const { user } = useAuth();
  const formRef = useRef(null);

  // Applications are tied to the signed-in account's email.
  useEffect(() => {
    if (user?.email) setForm(f => ({ ...f, email: user.email, artist_name: f.artist_name || user.full_name || "" }));
  }, [user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  const openForm = () => {
    if (!user) { base44.auth.redirectToLogin(window.location.href); return; }
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  useEffect(() => {
    base44.entities.FeaturedArtistApplication.filter({ status: "approved" }, "-featured_since", 20)
      .then(data => { setFeatured(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.artist_name || !form.email || !form.bio) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      await base44.entities.FeaturedArtistApplication.create({ ...form, email: user?.email || form.email, status: "pending" });
      setSubmitted(true);
      toast.success("Application submitted! We'll be in touch.");
    } catch (err) {
      toast.error(`Couldn't submit your application — ${err?.message || "please try again"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-yellow-950 via-amber-900 to-orange-950 pt-20 pb-16 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-500/20 via-transparent to-transparent" />
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <Badge className="mb-4 bg-yellow-500/20 text-yellow-300 border-yellow-500/30 px-4 py-1.5 text-xs tracking-widest uppercase">
              ⭐ Featured Artists Program
            </Badge>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tight">
              The <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">Spotlight</span> is Yours
            </h1>
            <p className="text-yellow-200/70 text-lg max-w-xl mx-auto mb-8">
              AIVTV's Featured Artist program puts exceptional AI music creators front and center on the platform.
            </p>
            <Button onClick={openForm}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold px-8 py-3 rounded-full text-sm">
              <Star className="w-4 h-4 mr-2" /> Apply Now
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Benefits */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { icon: Star, title: "Homepage Feature", desc: "Your profile and music featured prominently on the AIVTV homepage and radio channels.", color: "text-yellow-400" },
            { icon: Users, title: "Community Boost", desc: "Dedicated social posts, newsletter features, and community shoutouts across all channels.", color: "text-purple-400" },
            { icon: Music, title: "Session Priority", desc: "Priority scheduling for live sessions, premieres, and special access to platform features.", color: "text-blue-400" },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="p-6 rounded-2xl bg-card border border-border">
              <Icon className={`w-8 h-8 mb-4 ${color}`} />
              <h3 className="font-bold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        {/* Featured Artists Grid */}
        <h2 className="text-2xl font-black text-foreground mb-6">🎤 Current Featured Artists</h2>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {Array(4).fill(0).map((_, i) => <div key={i} className="aspect-square rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : featured.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
            <Mic className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No featured artists yet</p>
            <p className="text-sm mt-1">Be the first to apply!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {featured.map((artist, i) => (
              <motion.div key={artist.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="group relative rounded-2xl overflow-hidden aspect-square bg-gradient-to-br from-yellow-900 to-orange-900 cursor-pointer">
                {artist.profile_image_url && (
                  <img src={artist.profile_image_url} alt={artist.artist_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <Badge className="bg-yellow-500/90 text-yellow-900 text-xs mb-2">⭐ Featured</Badge>
                  <h3 className="font-bold text-white text-sm">{artist.artist_name}</h3>
                  <p className="text-white/60 text-xs capitalize">{artist.genre}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Application Form */}
        {showForm && (
          <motion.div ref={formRef} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-12 p-8 rounded-3xl bg-card border border-border scroll-mt-24">
            <h2 className="text-2xl font-black text-foreground mb-2">Apply to Be Featured</h2>
            <p className="text-muted-foreground mb-8">Tell us about your music and why you'd be a great fit for the AIVTV spotlight.</p>

            {submitted ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Application Received!</h3>
                <p className="text-muted-foreground">We review applications weekly. You'll hear from us via email within 7 days.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Artist Name *</Label>
                  <Input value={form.artist_name} onChange={e => update("artist_name", e.target.value)} placeholder="Your artist name" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={form.email} readOnly disabled placeholder="your@email.com" className="rounded-xl" />
                  <p className="text-[11px] text-muted-foreground">Uses your account email so we can reach you.</p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Bio *</Label>
                  <Textarea value={form.bio} onChange={e => update("bio", e.target.value)} placeholder="Tell us about yourself and your music..." rows={3} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Primary Genre</Label>
                  <select value={form.genre} onChange={e => update("genre", e.target.value)} className={SELECT_CLS}>
                    <option value="">Select genre</option>
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>AI Tools You Use</Label>
                  <select value={form.ai_tools_used} onChange={e => update("ai_tools_used", e.target.value)} className={SELECT_CLS}>
                    <option value="">Primary tool</option>
                    {AI_TOOLS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Best Track URL</Label>
                  <Input value={form.sample_track_url} onChange={e => update("sample_track_url", e.target.value)} placeholder="Link to your best work" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Estimated Monthly Listeners</Label>
                  <Input value={form.monthly_listeners} onChange={e => update("monthly_listeners", e.target.value)} placeholder="e.g. 500, 5000+" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Social Links</Label>
                  <Input value={form.social_links} onChange={e => update("social_links", e.target.value)} placeholder="Instagram, SoundCloud, YouTube..." className="rounded-xl" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Why should you be featured?</Label>
                  <Textarea value={form.why_featured} onChange={e => update("why_featured", e.target.value)} placeholder="What makes your AI music unique? What impact are you having on the community?" rows={3} className="rounded-xl" />
                </div>
                <div className="md:col-span-2 flex gap-4">
                  <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold px-8 rounded-full">
                    {submitting ? "Submitting..." : <><Send className="w-4 h-4 mr-2" />Submit Application</>}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="rounded-full">Cancel</Button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}