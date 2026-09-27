import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User, Music, Mic2, Save, Camera, Globe, Twitter, Instagram,
  Youtube, ArrowLeft, CheckCircle2, Edit2, ExternalLink, Upload, Plus, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import MyCreatorActions from "@/components/fan/MyCreatorActions";
import ProfileModeChooser from "@/components/profile/ProfileModeChooser";
import FanProfileView from "@/components/profile/FanProfileView";
import { useAuth } from "@/lib/AuthContext";
import TipWalletsCard from "@/components/tipping/TipWalletsCard";

const BASE_GENRES = [
  "hip-hop", "trap", "drill", "afrobeats", "afro-trap",
  "edm", "house", "deep house", "tech house", "future bass", "dubstep", "drum & bass", "trance", "ambient electronic",
  "pop", "dark pop", "hyperpop", "synth-pop", "indie pop",
  "r&b", "neo soul", "alternative r&b",
  "lo-fi", "lo-fi hip-hop", "lo-fi beats",
  "jazz", "jazz fusion", "nu jazz",
  "rock", "indie rock", "alternative", "post-rock",
  "classical", "cinematic", "orchestral",
  "reggaeton", "latin trap", "cumbia",
  "country", "folk", "americana",
  "soul", "funk", "disco",
  "metal", "punk",
  "world", "experimental", "other"
];

const BASE_AI_TOOLS = [
  // Music generation
  "Suno", "Udio", "Loudly", "Nuro", "Sonic", "Producer", "Beatoven", "Aiva", "Soundraw",
  "Mubert", "Boomy", "Stable Audio", "MusicGen", "AudioCraft",
  // Voice / vocal AI
  "ElevenLabs", "Kling", "Resemble AI", "Voicify", "SpliceAI", "Kits.ai",
  // Video & visuals
  "LTX", "Runway ML", "Pika Labs", "Kling AI", "Luma AI", "Sora", "Midjourney", "DALL-E", "Stable Diffusion", "Adobe Firefly",
  // Production & mixing
  "iZotope RX", "LANDR", "Accusonus", "Neutron AI", "Ozone AI",
  // Lyrics & writing
  "ChatGPT", "Claude", "Gemini", "Jasper",
  // DAW / Tools
  "Logic Pro", "Ableton", "FL Studio", "GarageBand",
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

const BANNER_TEMPLATES = [
  { url: "https://media.base44.com/images/public/69f37db5a0cc60c31a7afc80/5562b0990_generated_image.png", label: "Hip-Hop × AI" },
  { url: "https://media.base44.com/images/public/69f37db5a0cc60c31a7afc80/7dac9ae6f_generated_image.png", label: "EDM × AI" },
  { url: "https://media.base44.com/images/public/69f37db5a0cc60c31a7afc80/5c9927c16_generated_image.png", label: "Lo-Fi × AI" },
  { url: "https://media.base44.com/images/public/69f37db5a0cc60c31a7afc80/75c98e094_generated_image.png", label: "R&B × AI" },
  { url: "https://media.base44.com/images/public/69f37db5a0cc60c31a7afc80/e2dc7ab95_generated_image.png", label: "Trap × AI" },
];

export default function MyProfile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("view"); // "view" | "edit" | "setup" | "choose" | "fan"
  const [choosing, setChoosing] = useState(false);
  const [selectedTools, setSelectedTools] = useState([]);
  const [customToolInput, setCustomToolInput] = useState("");
  const [customGenreInput, setCustomGenreInput] = useState("");
  const [availableTools, setAvailableTools] = useState(() => getStoredList(STORAGE_KEY_TOOLS, BASE_AI_TOOLS));
  const [availableGenres, setAvailableGenres] = useState(() => getStoredList(STORAGE_KEY_GENRES, BASE_GENRES));
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();

  const [form, setForm] = useState({
    display_name: "",
    bio: "",
    genre: "",
    location: "",
    website_url: "",
    avatar_url: "",
    banner_url: "",
    social_links: {},
    tipping_enabled: true,
    is_public: true,
    tip_wallets: {},
  });

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me().catch(() => null);
      if (!u) { navigate("/"); return; }
      setUser(u);

      const profiles = await base44.entities.ArtistProfile.filter({ user_id: u.id });
      if (profiles[0]) {
        const p = profiles[0];
        setProfile(p);
        setForm({
          display_name: p.display_name || u.full_name || "",
          bio: p.bio || "",
          genre: p.genre || "",
          location: p.location || "",
          website_url: p.website_url || "",
          avatar_url: p.avatar_url || "",
          banner_url: p.banner_url || "",
          social_links: p.social_links || {},
          tipping_enabled: p.tipping_enabled !== false,
          is_public: p.is_public !== false,
          tip_wallets: p.tip_wallets || {},
        });
        setSelectedTools(p.ai_tools || []);
        setMode("view");
      } else {
        // First time — pre-fill from auth user
        setForm(f => ({ ...f, display_name: u.full_name || "" }));
        // Fans don't need an artist profile — honor their saved choice
        setMode(u.profile_choice === "fan" ? "fan" : "choose");
      }
      setLoading(false);
    };
    load();
  }, [navigate]);

  const toggleTool = (tool) => {
    setSelectedTools(prev =>
      prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]
    );
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

  const addCustomGenre = () => {
    const trimmed = customGenreInput.trim().toLowerCase();
    if (!trimmed) return;
    const updated = availableGenres.includes(trimmed) ? availableGenres : [...availableGenres, trimmed];
    setAvailableGenres(updated);
    saveToStorage(STORAGE_KEY_GENRES, BASE_GENRES, updated);
    setForm(f => ({ ...f, genre: trimmed }));
    setCustomGenreInput("");
  };

  const uploadImage = async (file, field) => {
    const setter = field === "avatar_url" ? setUploadingAvatar : setUploadingBanner;
    setter(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, [field]: file_url }));
      toast.success("Image uploaded!");
    } catch (err) {
      toast.error("Upload failed: " + err.message);
    }
    setter(false);
  };

  const handleSave = async () => {
    if (!form.display_name.trim()) {
      toast.error("Display name is required");
      return;
    }
    setSaving(true);
    try {
      const profileData = {
        ...form,
        user_id: user.id,
        user_email: user.email,
        ai_tools: selectedTools,
        slug: form.display_name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      };

      if (profile) {
        await base44.entities.ArtistProfile.update(profile.id, profileData);
        setProfile({ ...profile, ...profileData });
        toast.success("Profile updated!");
      } else {
        const created = await base44.entities.ArtistProfile.create(profileData);
        setProfile(created);
        toast.success("Profile created!");
      }

      // If user marked themselves as creator, update user record and refresh
      // the auth context so the header nav updates without a page reload
      if (!user.is_creator) {
        await base44.auth.updateMe({ is_creator: true, profile_choice: "creator" });
        checkUserAuth();
      }

      setMode("view");
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  // ─── FAN / CREATOR CHOICE ────────────────────────────────────────────────────
  if (mode === "choose") {
    const handleChoice = async (choice) => {
      if (choice === "creator") { setMode("setup"); return; }
      setChoosing(true);
      try {
        await base44.auth.updateMe({ profile_choice: "fan" });
        checkUserAuth(); // refresh header nav immediately
      } catch { /* non-fatal — fan view still works this session */ }
      setChoosing(false);
      setMode("fan");
    };
    return <ProfileModeChooser onChoose={handleChoice} busy={choosing} />;
  }

  if (mode === "fan") {
    return <FanProfileView user={user} onBecomeCreator={() => setMode("setup")} />;
  }

  // ─── SETUP / EDIT FORM ───────────────────────────────────────────────────────
  if (mode === "setup" || mode === "edit") {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => mode === "edit" ? setMode("view") : navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-semibold">{mode === "edit" ? "Back" : "Cancel"}</span>
          </button>
        </div>

        {/* Hero Banner */}
        <div className="relative h-36 bg-gradient-to-br from-purple-900 via-indigo-900 to-pink-900">
          {form.banner_url && <img src={form.banner_url} alt="Banner" className="absolute inset-0 w-full h-full object-cover opacity-60" />}
        </div>

        <div className="max-w-2xl mx-auto px-6 -mt-12 pb-20">
          {/* Title */}
          <div className="mb-8 pt-16">
            <h1 className="text-3xl font-black text-foreground">
              {mode === "setup" ? "🎤 Set Up Your Profile" : "✏️ Edit Profile"}
            </h1>
            {mode === "setup" && (
              <p className="text-muted-foreground mt-2">
                Create your artist identity. This is how the community will know you.
              </p>
            )}
          </div>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <h3 className="font-black text-foreground">Basic Info</h3>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">
                  Display Name *
                </label>
                <Input
                  value={form.display_name}
                  onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                  placeholder="Your artist name"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Bio</label>
                <Textarea
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder="Tell the world about yourself and your music..."
                  rows={3}
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Genre</label>
                <div className="flex flex-wrap gap-1.5 mb-2 max-h-36 overflow-y-auto pr-1">
                  {availableGenres.map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, genre: g }))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                        form.genre === g
                          ? "bg-purple-600 text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={customGenreInput}
                    onChange={e => setCustomGenreInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addCustomGenre()}
                    placeholder="Add genre (e.g. phonk, afrobeats…)"
                    className="rounded-xl text-sm"
                  />
                  <Button type="button" onClick={addCustomGenre} variant="outline" className="rounded-xl px-3 flex-shrink-0 gap-1">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {form.genre && <p className="text-xs text-purple-400 mt-1">Selected: <span className="capitalize font-semibold">{form.genre}</span></p>}
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Location</label>
                <Input
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="City, Country"
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Avatar & Banner */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
              <h3 className="font-black text-foreground">Images</h3>

              {/* Avatar */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-3 block">Avatar</label>
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-purple-700 to-indigo-700 flex-shrink-0 flex items-center justify-center">
                    {form.avatar_url
                      ? <img src={form.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      : <Camera className="w-6 h-6 text-white/40" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-border hover:border-purple-500/50 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-all w-full justify-center">
                      {uploadingAvatar
                        ? <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                        : <><Upload className="w-4 h-4" /> Upload Image</>}
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadImage(e.target.files[0], "avatar_url")} />
                    </label>
                    <p className="text-xs text-muted-foreground text-center">or paste a URL below</p>
                    <Input
                      value={form.avatar_url}
                      onChange={e => setForm(f => ({ ...f, avatar_url: e.target.value }))}
                      placeholder="https://..."
                      className="rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Banner */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-3 block">Banner</label>

                {/* Template picker */}
                <p className="text-xs text-muted-foreground mb-2">Choose a template or upload your own:</p>
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {BANNER_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.url}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, banner_url: tpl.url }))}
                      className={`relative h-12 rounded-lg overflow-hidden border-2 transition-all ${
                        form.banner_url === tpl.url ? "border-purple-500 ring-2 ring-purple-500/40" : "border-transparent hover:border-purple-500/40"
                      }`}
                      title={tpl.label}
                    >
                      <img src={tpl.url} alt={tpl.label} className="w-full h-full object-cover" />
                      {form.banner_url === tpl.url && (
                        <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-white drop-shadow" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {BANNER_TEMPLATES.map((tpl) => (
                    <span key={tpl.url} className="text-xs text-muted-foreground">{tpl.label}</span>
                  )).reduce((acc, el, i) => i === 0 ? [el] : [...acc, <span key={`sep-${i}`} className="text-muted-foreground/40 text-xs">·</span>, el], [])}
                </div>

                {/* Preview */}
                <div className="relative h-28 w-full rounded-xl overflow-hidden bg-gradient-to-br from-purple-900 via-indigo-900 to-pink-900 mb-2">
                  {form.banner_url && <img src={form.banner_url} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />}
                  <label className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/40 hover:bg-black/50 transition-colors">
                    {uploadingBanner
                      ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <div className="flex flex-col items-center gap-1 text-white/70 hover:text-white"><Upload className="w-5 h-5" /><span className="text-xs font-semibold">Upload Custom Banner</span></div>}
                    <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadImage(e.target.files[0], "banner_url")} />
                  </label>
                </div>
                <Input
                  value={form.banner_url}
                  onChange={e => setForm(f => ({ ...f, banner_url: e.target.value }))}
                  placeholder="or paste banner URL: https://..."
                  className="rounded-xl text-xs"
                />
              </div>
            </div>

            {/* AI Tools */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-3">
              <h3 className="font-black text-foreground">AI Tools You Use</h3>
              <p className="text-xs text-muted-foreground">Select presets or add your own</p>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                {availableTools.map(tool => (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => toggleTool(tool)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedTools.includes(tool)
                        ? "bg-purple-600 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {tool}
                  </button>
                ))}
              </div>

              {/* Add custom tool */}
              <div className="flex gap-2 pt-1">
                <Input
                  value={customToolInput}
                  onChange={e => setCustomToolInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCustomTool()}
                  placeholder="Add a tool (e.g. Suno, ChatGPT…)"
                  className="rounded-xl text-sm"
                />
                <Button type="button" onClick={addCustomTool} variant="outline" className="rounded-xl px-3 flex-shrink-0 gap-1">
                  <Plus className="w-4 h-4" /> Add
                </Button>
              </div>
            </div>

            {/* Social Links */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <h3 className="font-black text-foreground">Social Links</h3>
              {[
                { key: "twitter", label: "Twitter / X", icon: Twitter, placeholder: "https://twitter.com/..." },
                { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/..." },
                { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/..." },
                { key: "website", label: "Website", icon: Globe, placeholder: "https://..." },
              ].map(({ key, label, icon: Icon, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block flex items-center gap-1">
                    <Icon className="w-3 h-3" /> {label}
                  </label>
                  <Input
                    value={form.social_links[key] || ""}
                    onChange={e => setForm(f => ({
                      ...f,
                      social_links: { ...f.social_links, [key]: e.target.value }
                    }))}
                    placeholder={placeholder}
                    className="rounded-xl"
                  />
                </div>
              ))}
            </div>

            {/* Settings */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <h3 className="font-black text-foreground">Settings</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Public Profile</p>
                  <p className="text-xs text-muted-foreground">Let others discover your profile</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_public: !f.is_public }))}
                  className={`w-12 h-6 rounded-full transition-colors ${form.is_public ? "bg-purple-600" : "bg-muted"}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow mx-0.5 transition-transform ${form.is_public ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Accept Tips</p>
                  <p className="text-xs text-muted-foreground">Allow fans to tip you for your music</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, tipping_enabled: !f.tipping_enabled }))}
                  className={`w-12 h-6 rounded-full transition-colors ${form.tipping_enabled ? "bg-pink-600" : "bg-muted"}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow mx-0.5 transition-transform ${form.tipping_enabled ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              </div>
            </div>

            {form.tipping_enabled && (
              <TipWalletsCard value={form.tip_wallets} onChange={(tip_wallets) => setForm(f => ({ ...f, tip_wallets }))} />
            )}

            {/* Save */}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-6 rounded-2xl text-lg gap-2"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {mode === "setup" ? "Create My Profile" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── VIEW MODE ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Banner */}
      <div className="relative h-56 md:h-72 overflow-hidden">
        {profile?.banner_url ? (
          <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900 via-indigo-900 to-pink-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-20 relative z-10">
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row gap-6 items-end mb-8">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="w-28 h-28 md:w-36 md:h-36 rounded-2xl object-cover border-4 border-background shadow-2xl"
              />
            ) : (
              <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 border-4 border-background shadow-2xl flex items-center justify-center">
                <span className="text-4xl font-black text-white">
                  {(profile?.display_name || user?.full_name || "?")[0].toUpperCase()}
                </span>
              </div>
            )}
            {profile?.is_verified && (
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-blue-500 border-2 border-background flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 pb-2">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-3xl md:text-4xl font-black text-foreground">
                {profile?.display_name || user?.full_name}
              </h1>
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">You</Badge>
              {profile?.genre && (
                <Badge variant="outline" className="capitalize text-xs">{profile.genre}</Badge>
              )}
            </div>
            {profile?.bio && (
              <p className="text-muted-foreground text-sm max-w-lg leading-relaxed mb-3">{profile.bio}</p>
            )}
            <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
              {profile?.location && (
                <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{profile.location}</span>
              )}
              {profile?.ai_tools?.length > 0 && (
                <span>Tools: {profile.ai_tools.join(", ")}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-shrink-0 pb-2">
            <Button
              onClick={() => setMode("edit")}
              variant="outline"
              className="rounded-full gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            >
              <Edit2 className="w-4 h-4" /> Edit Profile
            </Button>
            {profile && (
              <Link to={`/artist/${user.id}`}>
                <Button variant="outline" className="rounded-full gap-2">
                  <ExternalLink className="w-4 h-4" /> Public View
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Stats */}
        {profile && (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-4 p-6 rounded-2xl bg-card border border-border mb-8">
            {[
              { label: "Tracks", value: profile.track_count || 0 },
              { label: "Followers", value: profile.follower_count || 0 },
              { label: "Following", value: profile.following_count || 0 },
              { label: "Total Plays", value: profile.total_plays || 0 },
              { label: "Tips Received", value: `$${((profile.total_tips_received_cents || 0) / 100).toFixed(2)}` },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-black text-foreground">{typeof value === "number" ? value.toLocaleString() : value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Social Links */}
        {profile?.social_links && Object.values(profile.social_links).some(Boolean) && (
          <div className="flex gap-3 mb-8 flex-wrap">
            {profile.social_links.twitter && (
              <a href={profile.social_links.twitter} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm text-muted-foreground hover:text-foreground hover:border-purple-500/30 transition-all">
                <Twitter className="w-4 h-4" /> Twitter
              </a>
            )}
            {profile.social_links.instagram && (
              <a href={profile.social_links.instagram} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm text-muted-foreground hover:text-foreground hover:border-purple-500/30 transition-all">
                <Instagram className="w-4 h-4" /> Instagram
              </a>
            )}
            {profile.social_links.youtube && (
              <a href={profile.social_links.youtube} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm text-muted-foreground hover:text-foreground hover:border-purple-500/30 transition-all">
                <Youtube className="w-4 h-4" /> YouTube
              </a>
            )}
            {profile.social_links.website && (
              <a href={profile.social_links.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm text-muted-foreground hover:text-foreground hover:border-purple-500/30 transition-all">
                <Globe className="w-4 h-4" /> Website
              </a>
            )}
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          {[
            { to: "/creator-dashboard", label: "🎵 My Studio" },
            { to: "/credits", label: "⚡ Credits & Plans" },
            { to: "/music-studio", label: "🎛️ Music Studio" },
            { to: "/voice-creator", label: "🎤 Voice Creator" },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="merc-card merc-card-hover p-4 rounded-2xl text-white font-bold text-sm text-center transition-all"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Phase 5 — My Creator Actions */}
        {user && (
          <div className="mb-8">
            <MyCreatorActions userId={user.id} />
          </div>
        )}

        {/* Account Info */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-12">
          <h3 className="font-black text-foreground mb-4">Account Info</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><span className="text-foreground font-semibold">Name:</span> {user?.full_name}</p>
            <p><span className="text-foreground font-semibold">Email:</span> {user?.email}</p>
            <p><span className="text-foreground font-semibold">Role:</span> <Badge variant="outline" className="text-xs">{user?.role}</Badge></p>
            <p><span className="text-foreground font-semibold">Creator:</span> {user?.is_creator ? <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">Active</Badge> : <Badge variant="outline" className="text-xs">Fan</Badge>}</p>
          </div>
        </div>
      </div>
    </div>
  );
}