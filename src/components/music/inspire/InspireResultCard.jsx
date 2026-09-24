import { motion } from 'framer-motion';
import { CheckCircle, Download, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Result card for a finished Inspire render. The sample rate is shown from the
// MEASURED value the backend read out of the WAV header, not from what was
// requested — a 48kHz claim is only worth showing if the file actually is one.
export default function InspireResultCard({ result, isContinuation, sourceTitle }) {
  const rate = result?.sample_rate;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-teal-500/30 p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <CheckCircle className="w-4 h-4 text-teal-400" />
        <span className="text-sm font-bold text-teal-400">Track Ready</span>
        <Badge variant="outline" className="text-xs">Inspire</Badge>
        <Badge variant="outline" className="text-xs">
          {rate ? `${Math.round(rate / 1000)}kHz WAV` : 'WAV'}
        </Badge>
        {isContinuation && <Badge variant="outline" className="text-xs">AI-assisted continuation</Badge>}
      </div>

      {isContinuation && sourceTitle && (
        <p className="text-xs text-muted-foreground">
          Continued from your track <span className="font-semibold text-foreground">{sourceTitle}</span> — the new
          track is linked back to it in your provenance chain.
        </p>
      )}

      {result?.cover_image_url && (
        <div className="flex items-center gap-3">
          <img src={result.cover_image_url} alt="Cover" className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-border" />
          <p className="text-xs text-muted-foreground">Auto-generated cover art</p>
        </div>
      )}

      <audio controls className="w-full rounded-xl" src={result?.audio_url} />

      <a href={result?.audio_url} download className="block">
        <Button variant="outline" className="w-full gap-2 rounded-xl">
          <Download className="w-4 h-4" /> Download WAV
        </Button>
      </a>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Sparkles className="w-3 h-3" /> Saved to your library automatically — a good starting point for SUB-Station or a continuation.
      </p>
    </motion.div>
  );
}