import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mic2, Zap, Copy, Download, RefreshCw, Save, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const MOODS = ['Happy', 'Sad', 'Energetic', 'Melancholic', 'Romantic', 'Angry', 'Chill'];
const STYLES = ['Hip-Hop', 'Pop', 'Rock', 'R&B', 'EDM', 'Indie', 'Country'];
const LENGTHS = ['Short (8-16 bars)', 'Medium (32 bars)', 'Long (64+ bars)'];

export default function LyricsStudio() {
  const [topic, setTopic] = useState('');
  const [mood, setMood] = useState('Happy');
  const [style, setStyle] = useState('Hip-Hop');
  const [length, setLength] = useState('Medium (32 bars)');
  const [lyrics, setLyrics] = useState('');
  const [loading, setLoading] = useState(false);

  const generateLyrics = async () => {
    if (!topic) {
      toast.error('Enter a topic first');
      return;
    }
    setLoading(true);
    try {
      const job = await base44.functions.invoke('generateLyrics', {
        topic,
        mood,
        style,
        length
      });
      // In production, poll for job completion
      setLyrics('Generated lyrics will appear here...');
      toast.success('Lyrics generation started!');
    } catch (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Back Button */}
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden pt-20 pb-12 px-6 bg-gradient-to-br from-pink-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-white mb-3 tracking-tight">🎤 Lyrics Studio</h1>
          <p className="text-white/60 text-lg">Create original lyrics powered by Nuro AI. Real-time refinement. Unlimited versions.</p>
        </div>
      </div>

      {/* Editor */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <h3 className="font-black text-foreground">Generation Settings</h3>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Topic / Theme</label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., lost love, overcoming fears, success"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Mood</label>
                <Select value={mood} onValueChange={setMood}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Style</label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Length</label>
                <Select value={length} onValueChange={setLength}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LENGTHS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={generateLyrics}
                disabled={loading || !topic}
                className="w-full bg-pink-600 hover:bg-pink-500 rounded-xl font-bold gap-2"
              >
                <Zap className="w-4 h-4" />
                {loading ? 'Generating…' : 'Generate Lyrics'}
              </Button>
            </div>
          </div>

          {/* Output Panel */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-2xl border border-border p-6 min-h-96">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-foreground">Your Lyrics</h3>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(lyrics);
                      toast.success('Copied!');
                    }}
                    className="rounded-xl h-8 gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-8 gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Export
                  </Button>
                </div>
              </div>

              <Textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder="Generated lyrics will appear here. Edit freely!"
                className="w-full h-80 rounded-xl font-mono text-sm resize-none"
              />

              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  className="rounded-xl gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" /> Regenerate
                </Button>
                <Button
                  className="bg-pink-600 hover:bg-pink-500 rounded-xl gap-1.5"
                >
                  <Save className="w-4 h-4" /> Save Version
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}