import { Crown, Music2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CostBadge from '@/components/credits/CostBadge';

// The craft output Maestro has landed on so far, plus the commit button.
// Shown only once a lyric actually exists, so a track can never be generated
// from an unfinished session.
export default function MaestroDraftCard({ draft, onGenerate, generating }) {
  if (!draft) return null;
  return (
    <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Crown className="w-4 h-4 text-amber-300" />
        <span className="text-sm font-black text-amber-200">Mastercraft draft ready</span>
        {draft.combination && <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/30 text-xs">{draft.combination}</Badge>}
      </div>

      {draft.title && <p className="text-sm font-bold text-foreground">"{draft.title}"</p>}

      <details className="rounded-lg bg-black/20 border border-amber-500/20 overflow-hidden">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-amber-200 flex items-center gap-1.5">
          <Music2 className="w-3.5 h-3.5" /> Lyrics
        </summary>
        <pre className="px-3 py-2.5 text-xs text-muted-foreground whitespace-pre-wrap font-sans max-h-64 overflow-y-auto border-t border-amber-500/20">
          {draft.lyrics}
        </pre>
      </details>

      {draft.sound_prompt && (
        <p className="text-xs text-amber-100/80 leading-relaxed">
          <span className="font-semibold text-amber-200">Style brief:</span> {draft.sound_prompt}
        </p>
      )}

      <Button onClick={onGenerate} disabled={generating}
        className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 font-bold gap-2">
        <Zap className="w-4 h-4" />
        {generating ? 'Sending to the studio…' : '🎵 Generate Track'}
        {!generating && <CostBadge cost={7} />}
      </Button>
      <p className="text-xs text-amber-100/60">Keep chatting to refine the lyric, mood or style before you commit.</p>
    </div>
  );
}