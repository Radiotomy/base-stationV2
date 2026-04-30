import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Music, Play, Download, RotateCcw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const GENRES = ['Hip-Hop', 'EDM', 'Pop', 'R&B', 'Rock', 'Lo-Fi', 'Jazz'];
const MOODS = ['Energetic', 'Chill', 'Dark', 'Happy', 'Sad', 'Uplifting'];

export default function MusicStudio() {
  const [provider, setProvider] = useState('loudly');
  const [duration, setDuration] = useState('30');
  const [genre, setGenre] = useState('Hip-Hop');
  const [mood, setMood] = useState('Energetic');
  const [tempo, setTempo] = useState('120');
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [jobId, setJobId] = useState('');

  const generateMusic = async () => {
    setGenerating(true);
    try {
      const result = await base44.functions.invoke('generateMusic', {
        provider,
        duration: parseInt(duration),
        genre,
        mood,
        tempo: parseInt(tempo)
      });
      setJobId(result.job_id);
      toast.success('Music generation started! Processing…');
      // In production, poll for completion
    } catch (error) {
      toast.error(error.message);
    }
    setGenerating(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden pt-20 pb-12 px-6 bg-gradient-to-br from-blue-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-white mb-3 tracking-tight">🎵 Music Studio</h1>
          <p className="text-white/60 text-lg">Generate AI tracks with Loudly, Nuro, Sonic, or Producer. Full metadata extraction.</p>
        </div>
      </div>

      {/* Generator */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-card rounded-2xl border border-border p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Provider</label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loudly">Loudly</SelectItem>
                  <SelectItem value="nuro">Nuro (Advanced)</SelectItem>
                  <SelectItem value="sonic">Sonic</SelectItem>
                  <SelectItem value="producer">Producer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Duration (seconds)</label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min="15"
                max="300"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Genre</label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENRES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <label className="text-xs font-semibold text-muted-foreground uppercase">Tempo (BPM)</label>
              <Input
                type="number"
                value={tempo}
                onChange={(e) => setTempo(e.target.value)}
                min="60"
                max="200"
                className="rounded-xl"
              />
            </div>
          </div>

          <Button
            onClick={generateMusic}
            disabled={generating}
            className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-lg py-6 gap-2"
          >
            <Zap className="w-5 h-5" />
            {generating ? 'Generating…' : 'Generate Music'}
          </Button>

          {audioUrl && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-muted/40 rounded-xl p-4">
              <audio controls className="w-full mb-3" src={audioUrl} />
              <Button className="w-full gap-2 rounded-xl">
                <Download className="w-4 h-4" /> Download Track
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}