import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Crown, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CostBadge from '@/components/credits/CostBadge';
import { handleCreditError } from '@/utils/creditErrors';
import { MODEL_DIALECTS } from '@/utils/modelLyricDialects';
import { getGrooveDefaults } from '@/utils/aceStepLyrics';

const GENRES = ['Pop', 'Hip-Hop', 'R&B', 'Country', 'Rock', 'EDM', 'Lo-Fi', 'Soul', 'Folk', 'Afrobeats'];
const MOODS = ['Energetic', 'Melancholy', 'Dreamy', 'Dark', 'Uplifting', 'Romantic', 'Aggressive', 'Chill'];

/**
 * 243 Masters songwriting for BASE Station's self-hosted engines, translated into
 * whichever conditioning dialect the target model speaks.
 *
 * One panel, many models: the same craft engine feeds Siren Song's tag channel
 * and Skye's prose channel, because the songwriting is identical and only the
 * ENCODING differs. Harmonix keeps its own panel — its ACE-Step lowercase tag
 * grammar predates this and is already tuned.
 *
 * Props:
 *   dialect       — key into MODEL_DIALECTS ('sirensong' | 'skye')
 *   onApply       — ({ style, lyrics, title, bpm, key }) => void
 *   fallbackTopic — the creator's existing description, used when the topic box
 *                   is empty so nobody has to type their idea twice
 */
export default function ModelMastersPanel({ dialect, onApply, fallbackTopic = '' }) {
  const [topic, setTopic] = useState('');
  const [genre, setGenre] = useState('Pop');
  const [mood, setMood] = useState('Energetic');
  const [running, setRunning] = useState(false);
  const [brief, setBrief] = useState(null);

  const spec = MODEL_DIALECTS[dialect];
  const effectiveTopic = topic.trim() || fallbackTopic.trim();

  const run = async () => {
    if (!effectiveTopic) { toast.error('Give the Masters engine a topic to write about'); return; }
    setRunning(true);
    try {
      const res = await base44.functions.invoke('generate243Masters', {
        topic: effectiveTopic, genre, mood, max_chars: 3000,
      });
      const data = res.data;
      const style = spec.toStyle(data, { genre, mood });
      const lyrics = spec.toLyrics(data.lyrics);
      setBrief({ ...data, style });
      const fallback = getGrooveDefaults(genre);
      onApply({
        style, lyrics, title: data.title,
        bpm: data.bpm || fallback.bpm,
        key: data.key || '',
      });
      toast.success(`Masters brief applied — formatted for ${spec.name}`);
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
      <div className="flex items-center gap-2 flex-wrap">
        <Crown className="w-4 h-4 text-amber-300" />
        <p className="text-sm font-black text-amber-200">243 Masters — {spec.name} Edition</p>
        <Badge variant="outline" className="text-[10px]">{spec.engine} formatted</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Nashville/LA rhyme craft, chords and arrangement from the 243 Masters engine — then encoded as{' '}
        {spec.styleHint}
      </p>

      <textarea
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={2}
        placeholder={fallbackTopic.trim()
          ? `Optional — leave blank to write about: "${fallbackTopic.trim().slice(0, 70)}"`
          : "What's the song about? e.g. leaving a town that never loved you back"}
        className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
      />

      <div className="grid grid-cols-2 gap-2">
        <select value={genre} onChange={(e) => setGenre(e.target.value)}
          className="rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          {GENRES.map((g) => <option key={g} value={g} className="bg-background">{g}</option>)}
        </select>
        <select value={mood} onChange={(e) => setMood(e.target.value)}
          className="rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          {MOODS.map((m) => <option key={m} value={m} className="bg-background">{m}</option>)}
        </select>
      </div>

      <Button onClick={run} disabled={running || !effectiveTopic}
        className="w-full gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold">
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        {running ? 'Masters are writing…' : 'Write with 243 Masters'}
        {!running && <CostBadge cost={3} />}
      </Button>
      {!effectiveTopic && (
        <p className="text-[11px] text-amber-300/80">
          Add a topic above — or describe your track — to unlock the Masters engine.
        </p>
      )}

      {brief && (
        <div className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-amber-500/20">
          <p>
            <span className="text-amber-300 font-semibold">Key:</span> {brief.key || '—'} ·{' '}
            <span className="text-amber-300 font-semibold">BPM:</span> {brief.bpm || '—'}
          </p>
          {brief.masters_used?.length > 0 && (
            <p><span className="text-amber-300 font-semibold">Craft references:</span> {brief.masters_used.map((m) => m.n).join(', ')}</p>
          )}
          <p className="break-words">
            <span className="text-amber-300 font-semibold">{spec.styleLabel}:</span> {brief.style}
          </p>
        </div>
      )}
    </div>
  );
}