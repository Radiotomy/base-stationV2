import { Mic2, ShieldAlert, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Voicebank selection. Licence text is shown per bank rather than buried: a
 * community DiffSinger bank may be free, non-commercial, or trained on a real
 * singer without consent, and only the creator can judge what they may ship.
 */
export default function VoicebankPicker({ banks, selected, onSelect, loading, onRefresh }) {
  if (loading) {
    return <p className="text-xs text-muted-foreground">Checking which voices are installed…</p>;
  }

  if (banks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-bold">No voicebanks available yet</p>
        <p className="text-[11px] text-muted-foreground">
          Cantor is the engine; a voicebank is the voice. Either none are installed yet or
          the engine is waking up — you can still write and save your score now.
        </p>
        <Button size="sm" variant="outline" onClick={onRefresh} className="rounded-lg gap-1.5 text-xs">
          <RefreshCw className="w-3 h-3" /> Check again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {banks.map(bank => {
        const disabled = bank.renderable === false;
        const active = selected === bank.id;
        return (
          <button
            key={bank.id}
            onClick={() => !disabled && onSelect(bank.id)}
            disabled={disabled}
            className={`w-full text-left p-3 rounded-xl border transition-colors ${
              active ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-muted/30'
            } ${disabled ? 'opacity-50' : 'hover:border-emerald-500/50'}`}
          >
            <div className="flex items-center gap-2">
              <Mic2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-xs font-bold truncate">{bank.name || bank.id}</span>
              {bank.language && (
                <span className="text-[10px] text-muted-foreground uppercase">{bank.language}</span>
              )}
            </div>
            {bank.license && (
              <p className="text-[10px] text-muted-foreground mt-1 flex items-start gap-1">
                <ShieldAlert className="w-3 h-3 shrink-0 mt-px" />
                <span className="line-clamp-2">{bank.license}</span>
              </p>
            )}
            {disabled && (
              <p className="text-[10px] text-destructive mt-1">
                Incomplete install — missing a required model file.
              </p>
            )}
          </button>
        );
      })}
      <p className="text-[11px] text-muted-foreground">
        Check each voice's licence before releasing a track built with it.
      </p>
    </div>
  );
}