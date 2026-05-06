import { Check, X, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Phase 5.5 — Renders a single smoke-test group as a card.
 */
export default function SmokeTestResultCard({ groupName, tests }) {
  const entries = Object.entries(tests || {});
  const passed = entries.filter(([, t]) => t.status === 'pass').length;
  const failed = entries.length - passed;

  return (
    <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-foreground capitalize">{groupName.replace(/([A-Z])/g, ' $1').trim()}</h3>
        <div className="flex gap-1.5">
          <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-xs">{passed} pass</Badge>
          {failed > 0 && <Badge className="bg-red-500/20 text-red-300 border-0 text-xs">{failed} fail</Badge>}
        </div>
      </div>

      <div className="space-y-1.5">
        {entries.length === 0 && <p className="text-xs text-muted-foreground">No tests recorded.</p>}
        {entries.map(([name, test]) => (
          <div key={name} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
            <div className="mt-0.5 flex-shrink-0">
              {test.status === 'pass'
                ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                : <X className="w-3.5 h-3.5 text-red-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-foreground">{name}</p>
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />{test.ms}ms
                </span>
              </div>
              {test.status === 'fail' && (
                <p className="text-xs text-red-400 mt-0.5 break-all">{test.error}</p>
              )}
              {test.status === 'pass' && test.detail && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {Object.entries(test.detail).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}