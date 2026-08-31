import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Wand2, Gift, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import InfoTip from '@/components/common/InfoTip';
import { MODEL_DIALECTS } from '@/utils/modelLyricDialects';

/**
 * The free, light song assistant. One plain description in — a complete,
 * model-correct starting point out.
 *
 * The backend deliberately returns a NEUTRAL brief; the translation into this
 * engine's dialect happens here via MODEL_DIALECTS, so Coda gets dense comma
 * tokens, Siren Song gets tag tokens and Skye gets prose from the SAME draft.
 * Sending a Skye prose sentence into Siren Song's tag encoder would steer
 * almost nothing, which is exactly why this isn't one shared formatter.
 *
 * Props:
 *   dialect     — 'coda' | 'sirensong' | 'skye'
 *   duration    — target seconds, so the draft doesn't overrun the render
 *   instrumental— skip lyrics entirely
 *   onApply     — ({ style, lyrics, title, brief }) => void
 */
export default function SongIdeaAssistant({ dialect, duration = 120, instrumental = false, onApply, disabled }) {
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const spec = MODEL_DIALECTS[dialect];
  if (!spec) return null;

  const draft = async () => {
    if (!description.trim()) { toast.error('Describe your song idea first'); return; }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('assistSongIdea', {
        description, duration, instrumental,
      });
      const brief = res.data?.brief;
      if (!brief) { toast.error('Could not draft that idea — try rephrasing'); return; }

      // The vocal description has to ride INSIDE the production brief, because
      // every dialect converter builds the style channel from production_brief
      // and none of them look at a separate vocal field. Left on its own it
      // would be drafted, returned, and then silently thrown away — which is
      // precisely the vocal steering these models most need.
      const styled = {
        ...brief,
        production_brief: [brief.production_brief, brief.vocal_description && `lead vocal: ${brief.vocal_description}`]
          .filter(Boolean).join(' '),
      };

      onApply({
        style: spec.toStyle(styled, { genre: brief.genre, mood: brief.mood }),
        lyrics: brief.lyrics ? spec.toLyrics(brief.lyrics) : '',
        title: brief.title || '',
        brief,
      });
      toast.success(`✨ ${spec.name} draft ready — edit anything before generating`);
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Assistant failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Wand2 className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-bold text-amber-300">Song Assistant</span>
        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] gap-1">
          <Gift className="w-2.5 h-2.5" /> FREE
        </Badge>
        <InfoTip text={`Describe your idea in plain words. The assistant writes the lyrics and fills in tempo, key and production detail, then formats it as ${spec.styleHint}`} />
      </div>

      <textarea value={description} onChange={(e) => setDescription(e.target.value)}
        rows={2} maxLength={1500} disabled={disabled || busy}
        placeholder="e.g. a late-night breakup song about driving out of Tulsa at 3am, slow and defeated"
        className="w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />

      <Button onClick={draft} disabled={disabled || busy || !description.trim()}
        className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 font-bold gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        {busy ? 'Writing your song…' : `Write it for ${spec.name}`}
      </Button>

      <AnimatePresence>
        {busy && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-[11px] text-muted-foreground text-center">
            Drafting lyrics, tempo, key and production notes for {spec.engine}…
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}