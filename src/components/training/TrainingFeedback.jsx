import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { ThumbsUp, ThumbsDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Rate a generation so BASE-Harmonix can learn from it.
 *
 * Consent-gated: users who have not opted in see the invitation instead of the
 * rating controls, and nothing is recorded until they accept. The backend
 * re-checks the flag, so declining here genuinely means no data is collected.
 */
export default function TrainingFeedback({ sampleId, onOptIn }) {
  const [optedIn, setOptedIn] = useState(null);
  const [rated, setRated] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setOptedIn(!!u.training_opt_in)).catch(() => setOptedIn(false));
  }, []);

  const acceptOptIn = async () => {
    await base44.auth.updateMe({ training_opt_in: true, training_opt_in_date: new Date().toISOString() });
    setOptedIn(true);
    onOptIn?.();
    toast.success('Thanks — your ratings will help BASE-Harmonix improve');
  };

  const rate = async (rating) => {
    setRated(rating);
    if (!sampleId) return;
    await base44.functions.invoke('logTrainingSample', { sample_id: sampleId, rating }).catch(() => {});
    toast.success(rating === 'up' ? 'Logged as a good result' : 'Logged — we\'ll use this to improve');
  };

  if (optedIn === null) return null;

  if (!optedIn) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Help improve BASE-Harmonix?
        </p>
        <p className="text-[11px] text-muted-foreground leading-snug">
          If you opt in, we record the prompt and settings you used plus your rating — never your audio,
          never your lyrics. It stays private to BASE Station and you can turn it off any time.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={acceptOptIn} className="rounded-lg text-xs bg-amber-600 hover:bg-amber-500 font-bold">
            Opt in
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOptedIn('declined')} className="rounded-lg text-xs">
            No thanks
          </Button>
        </div>
      </div>
    );
  }

  if (optedIn === 'declined') return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground">How good was this?</span>
      <Button size="sm" variant={rated === 'up' ? 'default' : 'outline'} onClick={() => rate('up')}
        className="rounded-lg h-8 px-2.5">
        <ThumbsUp className="w-3.5 h-3.5" />
      </Button>
      <Button size="sm" variant={rated === 'down' ? 'default' : 'outline'} onClick={() => rate('down')}
        className="rounded-lg h-8 px-2.5">
        <ThumbsDown className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}