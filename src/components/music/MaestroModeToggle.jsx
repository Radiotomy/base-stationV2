import { Crown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

// Maestro Mode — routes Quick Generate lyrics through the Maestro Superagent's
// craft engine instead of the standard inline lyric engine.
export default function MaestroModeToggle({ enabled, onChange, disabled }) {
  return (
    <div className={`p-3.5 rounded-xl border transition-colors ${enabled ? 'border-amber-500/40 bg-amber-500/10' : 'border-border bg-card'}`}>
      <div className="flex items-start gap-3">
        <Crown className={`w-4 h-4 flex-shrink-0 mt-0.5 ${enabled ? 'text-amber-300' : 'text-muted-foreground'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-foreground">Maestro Mode</p>
          <p className="text-xs text-muted-foreground leading-snug mt-0.5">
            {enabled
              ? 'Chat directly with Maestro — describe the song, iterate on the lyric, mood and style, then generate when it feels right. Full master craft treatment: master combinations, narrative architecture, hook construction, emotional arc and a production-optimized style brief.'
              : 'Standard form-based Quick Generate — faster, no master craft pass.'}
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={onChange} disabled={disabled} className="mt-0.5" />
      </div>
    </div>
  );
}