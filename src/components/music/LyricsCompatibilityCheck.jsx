import { AlertCircle, AlertTriangle, Lightbulb, CheckCircle } from 'lucide-react';
import { checkLyricsCompatibility } from '@/config/modelLyricsSpec';

const ICONS = {
  error: { Icon: AlertCircle, cls: 'text-red-400' },
  warn:  { Icon: AlertTriangle, cls: 'text-amber-400' },
  tip:   { Icon: Lightbulb, cls: 'text-blue-300' },
};

/** Live per-model lyrics compatibility meter + warnings. */
export default function LyricsCompatibilityCheck({ lyrics, provider, model, mode = 'song' }) {
  if (!lyrics?.trim()) return null;
  const { ok, chars, maxChars, spec, issues } = checkLyricsCompatibility({ lyrics, provider, model, mode });
  const pct = Math.min(100, Math.round((chars / maxChars) * 100));
  const barColor = pct > 100 || !ok ? 'bg-red-500' : pct > 90 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="mt-2 p-3 rounded-xl bg-muted/40 border border-border space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-muted-foreground">
          Lyrics vs <span className="text-foreground">{model}</span>
        </span>
        <span className={`font-mono ${chars > maxChars ? 'text-red-400 font-bold' : 'text-muted-foreground'}`}>
          {chars.toLocaleString()} / {maxChars.toLocaleString()} chars
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-border overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {issues.length === 0 && (
        <p className="text-xs text-emerald-400 flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Fully compatible — fits the model's budget{spec.languages ? ` · ${spec.languages}` : ''}
        </p>
      )}
      {issues.map((issue, i) => {
        const { Icon, cls } = ICONS[issue.level] || ICONS.tip;
        return (
          <p key={i} className={`text-xs flex items-start gap-1.5 ${cls}`}>
            <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {issue.msg}
          </p>
        );
      })}
    </div>
  );
}