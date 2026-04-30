import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Music, FileText, ImageIcon, Loader2, Copy, Download, RefreshCw, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const TOOLS = [
  { id: "lyrics", icon: FileText, label: "Lyric Studio", desc: "Generate full song lyrics with verses, hooks & bridges", color: "from-violet-900 to-purple-900", accent: "text-violet-400", badge: "AI-Powered" },
  { id: "prompt", icon: Music, label: "Music Prompt Builder", desc: "Craft the perfect prompt for Suno, Udio, or any AI music tool", color: "from-pink-900 to-rose-900", accent: "text-pink-400", badge: "Smart" },
  { id: "cover", icon: ImageIcon, label: "Cover Art Generator", desc: "Create stunning AI-generated album/track cover art", color: "from-indigo-900 to-blue-900", accent: "text-indigo-400", badge: "Visual AI" },
];

const GENRES = ["hip-hop", "edm", "pop", "r&b", "lo-fi", "rock", "jazz", "trap", "classical", "other"];
const MOODS = ["energetic", "chill", "dark", "uplifting", "melancholic", "aggressive", "romantic", "mysterious"];
const VIBES = ["club banger", "bedroom pop", "cinematic", "underground", "radio-ready", "experimental", "nostalgic", "futuristic"];

export default function AIStudio() {
  const [activeTool, setActiveTool] = useState("lyrics");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null);

  // Lyrics state
  const [lyricsForm, setLyricsForm] = useState({ topic: "", genre: "hip-hop", mood: "energetic", style: "", verse_count: "2" });

  // Prompt builder state
  const [promptForm, setPromptForm] = useState({ concept: "", genre: "edm", mood: "energetic", vibe: "club banger", bpm: "", instruments: "", references: "" });

  // Cover art state
  const [coverForm, setCoverForm] = useState({ track_title: "", artist_name: "", genre: "hip-hop", style: "photorealistic", mood: "dark", extra: "" });

  const generateLyrics = async () => {
    if (!lyricsForm.topic) { toast.error("Enter a topic or theme"); return; }
    setLoading(true); setResult(null);
    const prompt = `Write original song lyrics for a ${lyricsForm.genre} track in a ${lyricsForm.mood} mood.
Topic/Theme: ${lyricsForm.topic}
${lyricsForm.style ? `Style reference: ${lyricsForm.style}` : ""}
Structure: ${lyricsForm.verse_count} verses, 1 pre-chorus, 1 chorus, 1 bridge, final chorus.
Format clearly with [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge] labels.
Make it creative, original, and emotionally resonant. Avoid clichés.`;
    const res = await base44.integrations.Core.InvokeLLM({ prompt });
    setResult(res);
    setLoading(false);
  };

  const generateMusicPrompt = async () => {
    if (!promptForm.concept) { toast.error("Describe your concept first"); return; }
    setLoading(true); setResult(null);
    const prompt = `Create 3 variations of optimized AI music generation prompts for Suno/Udio/Riffusion.
Concept: ${promptForm.concept}
Genre: ${promptForm.genre} | Mood: ${promptForm.mood} | Vibe: ${promptForm.vibe}
${promptForm.bpm ? `BPM: ${promptForm.bpm}` : ""}
${promptForm.instruments ? `Instruments: ${promptForm.instruments}` : ""}
${promptForm.references ? `References: ${promptForm.references}` : ""}

For each variation, provide:
1. A short label (e.g. "Variation A — Cinematic")
2. The full prompt (60-120 words, detailed and specific)
3. One-line tip for best results

Make each variation meaningfully different in approach. Format clearly.`;
    const res = await base44.integrations.Core.InvokeLLM({ prompt });
    setResult(res);
    setLoading(false);
  };

  const generateCoverArt = async () => {
    if (!coverForm.track_title) { toast.error("Enter a track title"); return; }
    setLoading(true); setGeneratedImageUrl(null);
    const imgPrompt = `Album cover art for "${coverForm.track_title}" by ${coverForm.artist_name || "an artist"}.
Genre: ${coverForm.genre}. Mood: ${coverForm.mood}. Style: ${coverForm.style}.
${coverForm.extra ? `Additional details: ${coverForm.extra}` : ""}
Professional music cover art. Square format. Ultra high quality. No text or typography in the image.`;
    const res = await base44.integrations.Core.GenerateImage({ prompt: imgPrompt });
    setGeneratedImageUrl(res.url);
    setLoading(false);
  };

  const handleGenerate = () => {
    if (activeTool === "lyrics") generateLyrics();
    else if (activeTool === "prompt") generateMusicPrompt();
    else generateCoverArt();
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-950 via-purple-900 to-fuchsia-950 pt-20 pb-16 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-500/20 via-transparent to-transparent" />
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <Badge className="mb-4 bg-purple-500/20 text-purple-300 border-purple-500/30 px-4 py-1.5 text-xs tracking-widest uppercase">
              ✨ AI Tools Studio
            </Badge>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tight">
              Create with <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">AI</span>
            </h1>
            <p className="text-purple-200/70 text-lg max-w-xl mx-auto">
              Lyrics, music prompts, cover art — everything you need to bring your AI music to life. Powered by cutting-edge AI.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Tool Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {TOOLS.map(({ id, icon: Icon, label, desc, color, accent, badge }) => (
            <button key={id} onClick={() => { setActiveTool(id); setResult(null); setGeneratedImageUrl(null); }}
              className={`group relative p-5 rounded-2xl border text-left transition-all ${activeTool === id ? `bg-gradient-to-br ${color} border-white/20 shadow-lg` : "bg-card border-border hover:border-muted-foreground/30"}`}>
              <div className="flex items-start justify-between mb-3">
                <Icon className={`w-6 h-6 ${activeTool === id ? accent : "text-muted-foreground"}`} />
                <Badge className={`text-xs ${activeTool === id ? "bg-white/20 text-white border-0" : "bg-muted text-muted-foreground border-0"}`}>{badge}</Badge>
              </div>
              <p className={`font-bold text-sm mb-1 ${activeTool === id ? "text-white" : "text-foreground"}`}>{label}</p>
              <p className={`text-xs ${activeTool === id ? "text-white/60" : "text-muted-foreground"}`}>{desc}</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Panel */}
          <div className="space-y-5">
            <AnimatePresence mode="wait">
              {activeTool === "lyrics" && (
                <motion.div key="lyrics" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                  <h2 className="text-xl font-black text-foreground flex items-center gap-2"><FileText className="w-5 h-5 text-violet-400" /> Lyric Studio</h2>
                  <div className="space-y-2">
                    <Label>Topic / Theme *</Label>
                    <Textarea value={lyricsForm.topic} onChange={e => setLyricsForm(f => ({ ...f, topic: e.target.value }))} placeholder="e.g. Late night drives, chasing dreams, digital love..." rows={3} className="rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Genre</Label>
                      <Select value={lyricsForm.genre} onValueChange={v => setLyricsForm(f => ({ ...f, genre: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>{GENRES.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Mood</Label>
                      <Select value={lyricsForm.mood} onValueChange={v => setLyricsForm(f => ({ ...f, mood: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>{MOODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Style Reference <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input value={lyricsForm.style} onChange={e => setLyricsForm(f => ({ ...f, style: e.target.value }))} placeholder="e.g. Drake-inspired, poetic storytelling..." className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Verses</Label>
                    <Select value={lyricsForm.verse_count} onValueChange={v => setLyricsForm(f => ({ ...f, verse_count: v }))}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 verse</SelectItem>
                        <SelectItem value="2">2 verses</SelectItem>
                        <SelectItem value="3">3 verses</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </motion.div>
              )}

              {activeTool === "prompt" && (
                <motion.div key="prompt" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                  <h2 className="text-xl font-black text-foreground flex items-center gap-2"><Music className="w-5 h-5 text-pink-400" /> Music Prompt Builder</h2>
                  <div className="space-y-2">
                    <Label>Your Concept *</Label>
                    <Textarea value={promptForm.concept} onChange={e => setPromptForm(f => ({ ...f, concept: e.target.value }))} placeholder="e.g. An epic anthem about rising from nothing, heavy bass, motivational..." rows={3} className="rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Genre</Label>
                      <Select value={promptForm.genre} onValueChange={v => setPromptForm(f => ({ ...f, genre: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>{GENRES.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Mood</Label>
                      <Select value={promptForm.mood} onValueChange={v => setPromptForm(f => ({ ...f, mood: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>{MOODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Vibe</Label>
                      <Select value={promptForm.vibe} onValueChange={v => setPromptForm(f => ({ ...f, vibe: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>{VIBES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>BPM <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Input value={promptForm.bpm} onChange={e => setPromptForm(f => ({ ...f, bpm: e.target.value }))} placeholder="e.g. 140" className="rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Instruments <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input value={promptForm.instruments} onChange={e => setPromptForm(f => ({ ...f, instruments: e.target.value }))} placeholder="e.g. synths, 808s, violin..." className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>References <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input value={promptForm.references} onChange={e => setPromptForm(f => ({ ...f, references: e.target.value }))} placeholder="e.g. Kanye West, Daft Punk, The Weeknd..." className="rounded-xl" />
                  </div>
                </motion.div>
              )}

              {activeTool === "cover" && (
                <motion.div key="cover" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                  <h2 className="text-xl font-black text-foreground flex items-center gap-2"><ImageIcon className="w-5 h-5 text-indigo-400" /> Cover Art Generator</h2>
                  <div className="space-y-2">
                    <Label>Track Title *</Label>
                    <Input value={coverForm.track_title} onChange={e => setCoverForm(f => ({ ...f, track_title: e.target.value }))} placeholder="Your track name" className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Artist Name</Label>
                    <Input value={coverForm.artist_name} onChange={e => setCoverForm(f => ({ ...f, artist_name: e.target.value }))} placeholder="Your artist name" className="rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Genre</Label>
                      <Select value={coverForm.genre} onValueChange={v => setCoverForm(f => ({ ...f, genre: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>{GENRES.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Mood</Label>
                      <Select value={coverForm.mood} onValueChange={v => setCoverForm(f => ({ ...f, mood: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>{MOODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Visual Style</Label>
                    <Select value={coverForm.style} onValueChange={v => setCoverForm(f => ({ ...f, style: v }))}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["photorealistic", "digital art", "abstract", "cyberpunk", "minimalist", "oil painting", "anime", "neon noir", "vintage", "glitch art"].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Extra Details <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Textarea value={coverForm.extra} onChange={e => setCoverForm(f => ({ ...f, extra: e.target.value }))} placeholder="e.g. cityscape at night, lone figure, neon lights reflecting on rain..." rows={2} className="rounded-xl" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Button onClick={handleGenerate} disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-base">
              {loading ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-5 h-5 mr-2" /> Generate with AI</>
              )}
            </Button>
          </div>

          {/* Output Panel */}
          <div className="min-h-64">
            <AnimatePresence mode="wait">
              {loading && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="h-64 rounded-2xl bg-card border border-border flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-muted-foreground text-sm font-medium">AI is creating…</p>
                    <p className="text-muted-foreground text-xs mt-1">This takes a few seconds</p>
                  </div>
                </motion.div>
              )}

              {result && !loading && (
                <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-card border border-border overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <p className="font-bold text-sm text-foreground">Generated Output</p>
                    <div className="flex gap-2">
                      <Button onClick={handleGenerate} size="sm" variant="outline" className="rounded-xl h-8 text-xs gap-1">
                        <RefreshCw className="w-3 h-3" /> Regenerate
                      </Button>
                      <Button onClick={copyResult} size="sm" variant="outline" className="rounded-xl h-8 text-xs gap-1">
                        <Copy className="w-3 h-3" /> Copy
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 max-h-[500px] overflow-y-auto">
                    <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{result}</pre>
                  </div>
                </motion.div>
              )}

              {generatedImageUrl && !loading && (
                <motion.div key="image" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl overflow-hidden border border-border">
                  <img src={generatedImageUrl} alt="Generated cover art" className="w-full aspect-square object-cover" />
                  <div className="p-4 bg-card border-t border-border flex gap-2">
                    <Button onClick={handleGenerate} variant="outline" className="flex-1 rounded-xl text-sm gap-2">
                      <RefreshCw className="w-4 h-4" /> Regenerate
                    </Button>
                    <a href={generatedImageUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button className="w-full rounded-xl text-sm gap-2 bg-violet-600 hover:bg-violet-500">
                        <Download className="w-4 h-4" /> Open Full Size
                      </Button>
                    </a>
                  </div>
                </motion.div>
              )}

              {!result && !generatedImageUrl && !loading && (
                <div className="h-64 rounded-2xl bg-card border border-dashed border-border flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Your AI output will appear here</p>
                    <p className="text-xs mt-1">Fill in the form and click Generate</p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}