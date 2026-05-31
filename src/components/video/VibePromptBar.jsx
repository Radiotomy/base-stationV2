import { useState } from 'react';
import { Sparkles, Loader2, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import InfoTip from '@/components/common/InfoTip';

/**
 * One-line creative prompt: user describes the music video vibe in plain language,
 * an LLM generates a full storyboard (scene queries + durations + transitions)
 * matched to the current audio length and aspect ratio.
 */
export default function VibePromptBar({ audioDuration, aspectRatio, onStoryboard }) {
  const [vibe, setVibe] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!vibe.trim()) {
      toast.error('Describe your video vibe first');
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('generateVideoStoryboard', {
        vibe: vibe.trim(),
        audioDuration: audioDuration || 30,
        aspectRatio,
      });
      const scenes = res.data?.scenes;
      if (Array.isArray(scenes) && scenes.length > 0) {
        onStoryboard(scenes);
        toast.success(`Storyboard ready — ${scenes.length} scenes`);
      } else {
        toast.error(res.data?.error || 'No scenes returned');
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    }
    setLoading(false);
  };

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 space-y-2">
      <p className="text-xs font-semibold text-indigo-300 uppercase flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5" /> AI Storyboard
        <InfoTip text="Describe your music video in one line — the AI generates a full storyboard with scene queries, durations matched to your audio, and transitions between cuts." />
      </p>
      <div className="flex gap-2">
        <Input
          value={vibe}
          onChange={(e) => setVibe(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') generate(); }}
          placeholder="e.g. lonely city drive at midnight, neon reflections, melancholic"
          className="flex-1 text-sm bg-background/60"
          disabled={loading}
        />
        <Button
          type="button"
          onClick={generate}
          disabled={loading || !vibe.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 rounded-lg gap-1.5 font-bold"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          Generate
        </Button>
      </div>
    </div>
  );
}