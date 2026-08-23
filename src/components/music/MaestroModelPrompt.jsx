import { Crown, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { modelLabel } from '@/config/musicModelCatalog';

// Maestro never commits a model on the creator's behalf. When the craft engine
// recommends a different model than the one currently set, it asks first — the
// creator's own choice stands unless they accept.
export default function MaestroModelPrompt({ recommendation, currentModel, onAccept, onDecline }) {
  if (!recommendation) return null;
  const { model, provider, reason } = recommendation;

  return (
    <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 space-y-3">
      <div className="flex items-start gap-2.5">
        <Crown className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-amber-200">Maestro recommends a different model</p>
          <p className="text-xs text-muted-foreground mt-1">
            For this lyric and arrangement, Maestro suggests{' '}
            <span className="font-bold text-amber-200">{modelLabel(model) || model}</span>
            {provider ? <span className="text-muted-foreground"> on {provider === 'sonic' ? 'Sonic' : 'Tempolor'}</span> : null}
            {' '}instead of <span className="font-semibold text-foreground">{modelLabel(currentModel) || currentModel}</span>.
          </p>
          {reason && <p className="text-xs text-amber-200/80 mt-1.5">{reason}</p>}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={onAccept}
          className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold gap-1.5 text-xs">
          <Check className="w-3.5 h-3.5" /> Use Maestro's pick
        </Button>
        <Button size="sm" variant="outline" onClick={onDecline}
          className="rounded-xl text-xs gap-1.5">
          <X className="w-3.5 h-3.5" /> Keep {modelLabel(currentModel) || currentModel}
        </Button>
      </div>
    </div>
  );
}