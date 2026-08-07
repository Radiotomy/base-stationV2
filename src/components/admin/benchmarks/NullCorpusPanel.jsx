// Null corpus = unmarked audio. A detection here is a FAILURE, so this panel
// reports the false-positive rate per source_class and per codec — never blended,
// because codec damage is what consumes the detector's decision margin.

// Rule of three: with 0 events in n trials, the 95% upper bound is 3/n.
const bound = (n) => (n ? `< ${((3 / n) * 100).toFixed(1)}%` : '—');

function group(rows, key) {
  const out = {};
  for (const r of rows) {
    const k = r[key] || 'unclassified';
    out[k] = out[k] || { scans: 0, fp: 0 };
    out[k].scans += 1;
    if (r.false_positive) out[k].fp += 1;
  }
  return Object.entries(out).sort((a, b) => b[1].scans - a[1].scans);
}

function Table({ title, note, data }) {
  return (
    <div className="merc-card rounded-xl p-5">
      <p className="font-bold text-foreground text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mb-3">{note}</p>
      <div className="space-y-1">
        <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border pb-1.5">
          <span className="col-span-2">Group</span>
          <span className="text-right">Scans</span>
          <span className="text-right">FP rate</span>
        </div>
        {data.map(([k, v]) => (
          <div key={k} className="grid grid-cols-4 gap-2 text-xs py-1.5 border-b border-border/40">
            <span className="col-span-2 text-muted-foreground truncate">{k}</span>
            <span className="text-right tabular-nums text-foreground">{v.scans}</span>
            <span className={`text-right tabular-nums font-bold ${v.fp > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {v.fp > 0 ? `${((v.fp / v.scans) * 100).toFixed(1)}% (${v.fp})` : bound(v.scans)}
            </span>
          </div>
        ))}
        {!data.length && <p className="text-xs text-muted-foreground py-3">No null rows recorded yet.</p>}
      </div>
    </div>
  );
}

export default function NullCorpusPanel({ rows }) {
  const nullRows = rows.filter((r) => r.attack === 'null_unmarked');
  return (
    <div className="space-y-3">
      <Table
        title="False-positive rate by source class"
        note="0 events is reported as a 95% upper bound (rule of three), not as 0% — absence of a hit is not proof of a rate."
        data={group(nullRows, 'source_class')}
      />
      <Table
        title="False-positive rate by delivery codec"
        note="Lossy delivery is the common case and the likeliest source of a spurious hit, so it is reported separately."
        data={group(nullRows, 'codec')}
      />
    </div>
  );
}