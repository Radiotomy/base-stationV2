import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import IntelligenceResults from '@/components/studios/orvo/studio/IntelligenceResults';

/**
 * Optional, owner-only Episode Intelligence. Nothing runs until the creator
 * explicitly starts the analysis — this is a premium add-on candidate.
 */
export default function EpisodeIntelligencePanel({ episode }) {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  const run = async () => {
    setRunning(true);
    try {
      const { data } = await base44.functions.invoke('analyzeEpisode', { episode_id: episode.id });
      if (data?.analysis) setAnalysis(data.analysis);
      else toast({ title: 'Still processing', description: 'Analysis is taking longer than expected — try again shortly.' });
    } catch (e) {
      toast({ title: 'Analysis failed', description: e.message, variant: 'destructive' });
    }
    setRunning(false);
  };

  return (
    <div className="merc-card rounded-2xl p-5 mt-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#FF9A4D] mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Episode Intelligence
          </p>
          <p className="text-sm text-white/60 max-w-md">
            Optional deep analysis — speaker breakdown, sentiment, topics and quotable highlights for your show notes.
          </p>
        </div>
        <button
          onClick={run}
          disabled={running || !episode.audio_url}
          className="merc-button rounded-full px-5 py-2 text-sm font-black disabled:opacity-50 flex items-center gap-2"
        >
          {running && <Loader2 className="w-4 h-4 animate-spin" />}
          {running ? 'Analyzing…' : analysis ? 'Re-run analysis' : 'Run analysis'}
        </button>
      </div>

      {analysis && <IntelligenceResults analysis={analysis} />}
    </div>
  );
}