import { Database, ShieldAlert, Target, Layers } from 'lucide-react';

const CARDS = [
  { key: 'total', label: 'Benchmark rows', icon: Database, tone: 'text-foreground' },
  { key: 'nullScans', label: 'Null scans (unmarked)', icon: Layers, tone: 'text-foreground' },
  { key: 'falsePositives', label: 'False positives', icon: ShieldAlert, tone: 'text-emerald-400' },
  { key: 'recoveryPct', label: 'Recovery on marked rows', icon: Target, tone: 'text-foreground', suffix: '%' },
];

export default function BenchmarkStatStrip({ stats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {CARDS.map(({ key, label, icon: Icon, tone, suffix }) => (
        <div key={key} className="merc-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
          <p className={`text-2xl font-black tabular-nums ${key === 'falsePositives' && stats[key] > 0 ? 'text-red-400' : tone}`}>
            {stats[key]}{suffix || ''}
          </p>
        </div>
      ))}
    </div>
  );
}