import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import {
  Upload, Music, Link as LinkIcon, CheckCircle, Sparkles, ArrowRight,
  Plus, X, FileAudio, FolderOpen
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const BASE_GENRES = [
  "hip-hop", "trap", "drill", "edm", "house", "deep house", "future bass", "dubstep",
  "pop", "dark pop", "hyperpop", "r&b", "neo soul", "lo-fi", "jazz", "jazz fusion",
  "rock", "indie rock", "alternative", "classical", "cinematic", "reggaeton",
  "latin trap", "afrobeats", "soul", "funk", "other"
];

const BASE_AI_TOOLS = [
  "Suno", "Udio", "Loudly", "Nuro", "Sonic", "Producer", "Beatoven", "Aiva", "Soundraw",
  "Mubert", "Boomy", "Stable Audio", "MusicGen", "ElevenLabs", "Kits.ai",
  "Runway ML", "Pika Labs", "Luma AI", "Midjourney", "DALL-E", "Stable Diffusion",
  "ChatGPT", "Claude", "Multiple", "Other"
];

const STORAGE_KEY_TOOLS = "aivtv_custom_tools";
const STORAGE_KEY_GENRES = "aivtv_custom_genres";

function getStoredList(key, base) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "[]");
    const merged = [...base];
    stored.forEach(item => { if (!merged.includes(item)) merged.push(item); });
    return merged;
  } catch { return base; }
}

function saveToStorage(key, base, extras) {
  const newItems = extras.filter(e => !base.includes(e));
  try { localStorage.setItem(key, JSON.stringify(newItems)); } catch {}
}

// Track source modes
const SOURCE_MODES = [
  { key: "url", label: "🔗 External URL", desc: "SoundCloud, YouTube, Suno, Udio…" },
  { key: "library", label: "📚 From My Library", desc: "Tracks you made in Base Station studios" },
  { key: "upload", label: "⬆️ Upload File", desc: "Upload an audio file directly" },
];

export default function SubmitTrack() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploadingTrack, setUploadingTrack] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Source mode
  const [sourceMode, setSourceMode] = useState("url");
  const [libraryAssets, setLibraryAssets] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  // Chip selectors
  const [availableGenres, setAvailableGenres] = useState(() => getStoredList(STORAGE_KEY_GENRES, BASE_GENRES));
  const [availableTools, setAvailableTools] = useState(() => getStoredList(STORAGE_KEY_TOOLS, BASE_AI_TOOLS));
  const [customGenreInput, setCustomGenreInput] = useState("");
  const [customToolInput, setCustomToolInput] = useState("");
  const [selectedTools, setSelectedTools] = useState([]);

  const [form, setForm] = useState({
    title: "", description: "", track_url: "", cover_image_url: "",
    genre: "", tags: "", lyrics: "", bpm: ""
  });

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  // Load user's library assets when switching to library mode
  useEffect(() => {
    if (sourceMode === "library" && user && libraryAssets.length === 0) {
      setLibraryLoading(true);
      base44.entities.UserAsset.filter({ user_id: user.id, asset_type: "track" }, "-created_date", 50)
        .then(assets => { setLibraryAssets(assets); setLibraryLoading(false); })
        .catch(() => setLibraryLoading(false));
    }
  }, [sourceMode, user]);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleTool = (tool) => {
    setSelectedTools(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]);
  };

  const addCustomGenre = () => {
    const trimmed = customGenreInput.trim().toLowerCase();
    if (!trimmed) return;
    const updated = availableGenres.includes(trimmed) ? availableGenres : [...availableGenres, trimmed];
    setAvailableGenres(updated);
    saveToStorage(STORAGE_KEY_GENRES, BASE_GENRES, updated);
    setForm(f => ({ ...f, genre: trimmed }));
    setCustomGenreInput("");
  };

  const addCustomTool = () => {
    const trimmed = customToolInput.trim();
    if (!trimmed) return;
    const updated = availableTools.includes(trimmed) ? availableTools : [...availableTools, trimmed];
    setAvailableTools(updated);
    saveToStorage(STORAGE_KEY_TOOLS, BASE_AI_TOOLS, updated);
    if (!selectedTools.includes(trimmed)) setSelectedTools(prev => [...prev, trimmed]);
    setCustomToolInput("");
  };

  const handleSelectAsset = (asset) => {
    setSelectedAsset(asset);
    setForm(f => ({
      ...f,
      track_url: asset.file_url,
      title: f.title || asset.title || "",
      cover_image_url: f.cover_image_url || asset.thumbnail_url || "",
    }));
  };

  const handleUploadTrack = async (file) => {
    setUploadingTrack(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      update("track_url", file_url);
      if (!form.title) update("title", file.name.replace(/\.[^.]+$/, ""));
      toast.success("Track uploaded!");
    } catch (err) {
      toast.error("Upload failed: " + err.message);
    }
    setUploadingTrack(false);
  };

  const handleUploadCover = async (file) => {
    setUploadingCover(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      update("cover_image_url", file_url);
      toast.success("Cover uploaded!");
    } catch (err) {
      toast.error("Cover upload failed: " + err.message);
    }
    setUploadingCover(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.track_url) { toast.error("Title and track source are required"); return; }
    if (!user) { toast.error("You must be signed in to submit"); return; }
    setSubmitting(true);

    const tagsArr = form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [];

    await base44.entities.TrackSubmission.create({
      ...form,
      tags: tagsArr,
      bpm: form.bpm ? parseInt(form.bpm) : undefined,
      ai_tools_used: selectedTools.join(", "),
      artist_id: user.id,
      artist_name: user.full_name,
      artist_email: user.email,
      play_count: 0,
      like_count: 0,
      status: "pending",
    });

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
              <Button onClick={() => {
                setSubmitted(false);
                setSelectedTools([]);
                setSelectedAsset(null);
                setForm({ title: "", description: "", track_url: "", cover_image_url: "", genre: "", tags: "", lyrics: "", bpm: "" });
              }} variant="outline" className="rounded-full px-8">Submit Another</Button>
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

              {/* Genre Chips */}
              <div className="space-y-2">
                <Label>Genre</Label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 mb-2">
                  {availableGenres.map(g => (
                    <button key={g} type="button" onClick={() => update("genre", g)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                        form.genre === g ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}>
                      {g}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={customGenreInput} onChange={e => setCustomGenreInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustomGenre())}
                    placeholder="Add genre…" className="rounded-xl text-sm" />
                  <Button type="button" onClick={addCustomGenre} variant="outline" className="rounded-xl px-3 flex-shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {form.genre && <p className="text-xs text-emerald-400">Selected: <span className="capitalize font-semibold">{form.genre}</span></p>}
              </div>

              {/* AI Tools Chips */}
              <div className="space-y-2">
                <Label>AI Tools Used</Label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 mb-2">
                  {availableTools.map(tool => (
                    <button key={tool} type="button" onClick={() => toggleTool(tool)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        selectedTools.includes(tool) ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}>
                      {tool}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={customToolInput} onChange={e => setCustomToolInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustomTool())}
                    placeholder="Add a tool…" className="rounded-xl text-sm" />
                  <Button type="button" onClick={addCustomTool} variant="outline" className="rounded-xl px-3 flex-shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {selectedTools.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedTools.map(t => (
                      <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-medium">
                        {t}
                        <button type="button" onClick={() => toggleTool(t)}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
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

            {/* Track Source */}
            <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
              <h3 className="font-black text-foreground text-lg flex items-center gap-2"><LinkIcon className="w-5 h-5 text-emerald-400" /> Track Source *</h3>

              {/* Source Mode Selector */}
              <div className="grid grid-cols-3 gap-2">
                {SOURCE_MODES.map(({ key, label, desc }) => (
                  <button key={key} type="button" onClick={() => { setSourceMode(key); setSelectedAsset(null); update("track_url", ""); }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      sourceMode === key ? "border-emerald-500 bg-emerald-500/10" : "border-border hover:border-emerald-500/40"
                    }`}>
                    <p className="text-xs font-bold text-foreground mb-0.5">{label}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{desc}</p>
                  </button>
                ))}
              </div>

              {/* URL Mode */}
              {sourceMode === "url" && (
                <div className="space-y-2">
                  <Input value={form.track_url} onChange={e => update("track_url", e.target.value)}
                    placeholder="https://soundcloud.com/your-track" className="rounded-xl" />
                </div>
              )}

              {/* Upload Mode */}
              {sourceMode === "upload" && (
                <div className="space-y-2">
                  {form.track_url ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                      <FileAudio className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <p className="text-sm text-emerald-300 truncate flex-1">Track uploaded successfully</p>
                      <button type="button" onClick={() => update("track_url", "")} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className={`flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                      uploadingTrack ? "border-emerald-500/50 bg-emerald-500/5" : "border-border hover:border-emerald-500/50 hover:bg-emerald-500/5"
                    }`}>
                      {uploadingTrack
                        ? <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                        : <><Upload className="w-8 h-8 text-muted-foreground" /><span className="text-sm text-muted-foreground">Click to upload audio file</span><span className="text-xs text-muted-foreground/60">MP3, WAV, FLAC, AAC</span></>}
                      <input type="file" accept="audio/*" className="hidden" onChange={e => e.target.files[0] && handleUploadTrack(e.target.files[0])} disabled={uploadingTrack} />
                    </label>
                  )}
                </div>
              )}

              {/* Library Mode */}
              {sourceMode === "library" && (
                <div className="space-y-2">
                  {libraryLoading ? (
                    <div className="space-y-2">
                      {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
                    </div>
                  ) : libraryAssets.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-xl">
                      <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No tracks in your library yet.</p>
                      <Link to="/music-studio" className="text-xs text-purple-400 hover:text-purple-300 mt-1 block">Create one in Music Studio →</Link>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {libraryAssets.map(asset => (
                        <button key={asset.id} type="button" onClick={() => handleSelectAsset(asset)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                            selectedAsset?.id === asset.id ? "border-emerald-500 bg-emerald-500/10" : "border-border hover:border-emerald-500/30"
                          }`}>
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-800 to-indigo-900 flex-shrink-0 flex items-center justify-center overflow-hidden">
                            {asset.thumbnail_url ? <img src={asset.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <Music className="w-4 h-4 text-white/30" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{asset.title}</p>
                            {asset.metadata?.genre && <p className="text-xs text-muted-foreground capitalize">{asset.metadata.genre}</p>}
                          </div>
                          {selectedAsset?.id === asset.id && <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Show resolved URL */}
              {form.track_url && sourceMode !== "url" && (
                <p className="text-xs text-muted-foreground truncate">Track source: {form.track_url}</p>
              )}
            </div>

            {/* Cover Image */}
            <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
              <h3 className="font-black text-foreground text-lg">Cover Art <span className="text-muted-foreground text-sm font-normal">(optional)</span></h3>
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-purple-800 to-indigo-900 flex-shrink-0 flex items-center justify-center">
                  {form.cover_image_url ? <img src={form.cover_image_url} alt="Cover" className="w-full h-full object-cover" onError={e => e.target.style.display="none"} /> : <Music className="w-6 h-6 text-white/30" />}
                </div>
                <div className="flex-1 space-y-2">
                  <label className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-dashed border-border hover:border-purple-500/50 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-all">
                    {uploadingCover ? <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /> : <><Upload className="w-4 h-4" /> Upload Cover</>}
                    <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && handleUploadCover(e.target.files[0])} />
                  </label>
                  <Input value={form.cover_image_url} onChange={e => update("cover_image_url", e.target.value)} placeholder="or paste image URL: https://..." className="rounded-xl text-xs" />
                </div>
              </div>
            </div>

            {/* Lyrics */}
            <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-foreground text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-pink-400" /> Lyrics <span className="text-muted-foreground text-sm font-normal">(optional)</span></h3>
                <Link to="/ai-studio" className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1">
                  Generate with AI <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <Textarea value={form.lyrics} onChange={e => update("lyrics", e.target.value)} placeholder="Paste your lyrics here..." rows={5} className="rounded-xl font-mono text-sm" />
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