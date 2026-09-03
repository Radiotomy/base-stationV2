import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

/**
 * Standing consent control. Consent that can't be withdrawn as easily as it was
 * given isn't really consent, so this lives outside the generation flow too.
 */
export default function TrainingConsentToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    base44.auth.me()
      .then(u => { setEnabled(!!u.training_opt_in); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const toggle = async (next) => {
    setEnabled(next);
    await base44.auth.updateMe({
      training_opt_in: next,
      ...(next && { training_opt_in_date: new Date().toISOString() }),
    });
    toast.success(next ? 'Thanks for helping improve our BASE Engines' : 'Turned off — no further data will be collected');
  };

  if (!loaded) return null;

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card">
      <Sparkles className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">Help improve our BASE Engines</p>
        <p className="text-xs text-muted-foreground leading-snug mt-0.5">
          Shares the prompts, settings and ratings from your generations so our in-house model gets better.
          Your audio, your lyrics and your personal details are never included.
        </p>
      </div>
      <Switch checked={enabled} onCheckedChange={toggle} />
    </div>
  );
}