import { format } from 'date-fns';

export default function RunsTable({ rows }) {
  const runs = {};
  for (const r of rows) {
    const k = r.run_id || '(no run id)';
    runs[k] = runs[k] || { id: k, rows: 0, trials: 0, survived: 0, fp: 0, nulls: 0, layers: new Set(), date: r.created_date };
    const run = runs[k];
    run.rows += 1;
    run.layers.add(r.layer);
    if (r.attack === 'null_unmarked') run.nulls += 1;
    else { run.trials += r.trials || 1; run.survived += r.survived || 0; }
    if (r.false_positive) run.fp += 1;
    if (new Date(r.created_date) > new Date(run.date)) run.date = r.created_date;
  }
  const list = Object.values(runs).sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="merc-card rounded-xl p-5">
      <p className="font-bold text-foreground text-sm mb-3">Every recorded run</p>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border pb-1.5">
            <span className="col-span-4">Run</span>
            <span className="col-span-2">Date</span>
            <span className="col-span-2">Layers</span>
            <span className="col-span-2 text-right">Null / Marked</span>
            <span className="col-span-2 text-right">Recovery</span>
          </div>
          {list.map((r) => (
            <div key={r.id} className="grid grid-cols-12 gap-2 text-xs py-1.5 border-b border-border/40 items-center">
              <span className="col-span-4 text-foreground truncate" title={r.id}>{r.id}</span>
              <span className="col-span-2 text-muted-foreground">{r.date ? format(new Date(r.date), 'MMM d') : '—'}</span>
              <span className="col-span-2 text-muted-foreground truncate">{[...r.layers].join(', ')}</span>
              <span className="col-span-2 text-right tabular-nums text-muted-foreground">
                {r.nulls} / {r.trials}
                {r.fp > 0 && <span className="text-red-400 font-bold ml-1">{r.fp} FP</span>}
              </span>
              <span className="col-span-2 text-right tabular-nums font-bold text-foreground">
                {r.trials ? `${Math.round((r.survived / r.trials) * 100)}%` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}