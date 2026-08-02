import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Crown, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CostBadge from '@/components/credits/CostBadge';
import { handleCreditError } from '@/utils/creditErrors';
import { toAceStepLyrics, toHarmonixPrompt } from '@/utils/aceStepLyrics';

const GENRES = ['Pop', 'Hip-Hop', 'R&B', 'Country', 'Rock', 'EDM', 'Lo-Fi', 'Soul', 'Folk', 'Afrobeats'];
const MOODS = ['Energetic', 'Melancholy', 'Dreamy', 'Dark', 'Uplifting', 'Romantic', 'Aggressive', 'Chill'];

/**
 * 243 Masters songwriting, tuned for BASE-Harmonix.
 *
 * Same engine the Advanced tab uses, but the result is post-processed into
 * ACE-Step's structure-tag grammar and a comma-dense style prompt — the two
 * things that actually move Harmonix output quality.
 */
export default function HarmonixMastersPanel({ onApply }) {
  const [topic, setTopic] = useState('');
  const [genre, setGenre] = useState('Pop');
  const [mood, setMood] = useState('Energetic');
  const [running, setRunning] = useState(false);
  const [brief, setBrief] = useState(null);

  const run = async () => {
    if (!topic.trim()) { toast.error('Give the Masters engine a topic to write about'); return; }
    setRunning(true);
    try {
      const res = await base44.functions.invoke('generate243Masters', {
        topic, genre, mood, max_chars: 3000,
      });
      const data = res.data;
      const aceLyrics = toAceStepLyrics(data.lyrics);
      const prompt = toHarmonixPrompt(data, { genre, mood });
      setBrief({ ...data, aceLyrics, prompt });
      onApply({ lyrics: aceLyrics, prompt, title: data.title, bpm: data.bpm });
      toast.success('Masters brief applied — formatted for Harmonix');
    } catch (err) {
      if (!handleCreditError(err)) {
        toast.error(err?.response?.data?.error || err.message || 'Masters engine failed');
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Crown className="w-4 h-4 text-amber-300" />
        <p className="text-sm font-black text-amber-200">243 Masters — Harmonix Edition</p>
        <Badge variant="outline" className="text-[10px]">ACE-Step formatted</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Nashville/LA rhyme craft, chords and arrangement from the 243 Masters engine — then converted
        into the lowercase structure tags Harmonix was trained on, and a dense style prompt.
      </p>

      <textarea
        value={topic}
        onChange={e => setTopic(e.target.value)}
        rows={2}
        placeholder="What's the song about? e.g. leaving a town that never loved you back"
        className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
      />

      <div className="grid grid-cols-2 gap-2">
        <select value={genre} onChange={e => setGenre(e.target.value)}
          className="rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          {GENRES.map(g => <option key={g} value={g} className="bg-background">{g}</option>)}
        </select>
        <select value={mood} onChange={e => setMood(e.target.value)}
          className="rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          {MOODS.map(m => <option key={m} value={m} className="bg-background">{m}</option>)}
        </select>
      </div>

      <Button onClick={run} disabled={running || !topic.trim()}
        className="w-full gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold">
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        {running ? 'Masters are writing…' : 'Write with 243 Masters'}
        {!running && <CostBadge cost={3} />}
      </Button>

      {brief && (
        <div className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-amber-500/20">
          <p><span className="text-amber-300 font-semibold">Key:</span> {brief.key || '—'} · <span className="text-amber-300 font-semibold">BPM:</span> {brief.bpm || '—'}</p>
          {brief.masters_used?.length > 0 && (
            <p><span className="text-amber-300 font-semibold">Craft references:</span> {brief.masters_used.map(m => m.n).join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}