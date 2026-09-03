import { Sparkles } from 'lucide-react';

/**
 * MANDATORY LICENCE ATTRIBUTION — not decoration.
 *
 * The MiniMax-H3 Community License requires the "MiniMax-H3" name to be shown on
 * the UI of any commercial product built on the model. This component is the
 * only place that obligation is satisfied for the Nova engine, so it must stay
 * rendered wherever Nova is offered or its output is presented.
 *
 * variant 'notice' — the studio panel. variant 'badge' — a result card.
 */
export default function MiniMaxH3Attribution({ variant = 'notice' }) {
  if (variant === 'badge') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/15 text-[10px] font-bold text-foreground/80">
        <Sparkles className="w-2.5 h-2.5" /> MiniMax-H3
      </span>
    );
  }
  return (
    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-muted-foreground">
      <span className="font-bold text-foreground">Nova</span> is BASE Station's self-hosted deployment of{' '}
      <span className="font-bold text-foreground">MiniMax-H3</span> — the picture and its 32 kHz stereo
      soundtrack are generated in the same pass, so the sound belongs to the frames rather than being dubbed
      on afterwards. Runs on our own GPU worker, separate from the LTX engine.
    </div>
  );
}