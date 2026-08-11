import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// PUBLIC-SAFE chart. Outcome data only — measured payload recovery for the
// production cascade as a whole. No layer internals, no engine names, no
// thresholds, no bit-error telemetry: those stay behind the trust boundary.
const RESILIENCE = [
  { attack: 'Untouched master', pct: 100 },
  { attack: 'Metadata stripped', pct: 100 },
  { attack: 'Re-encoded / compressed', pct: 100 },
  { attack: 'Bandwidth reduced', pct: 100 },
  { attack: 'Noise added', pct: 100 },
  { attack: 'Cut to a 5s excerpt', pct: 100 },
  { attack: 'Speed / pitch altered', pct: 0 },
];

export default function PublicResilienceChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="font-bold text-foreground text-sm mb-1">Measured signature recovery</p>
      <p className="text-xs text-muted-foreground mb-4">
        Each bar is an attack applied to a finished, marked track, after which the file is re-scanned from
        scratch. A trial counts as recovered only when the identifier comes back <em>exactly</em>. Results
        come from BASE Station&apos;s own adversarial benchmark — including the results that go against us.
      </p>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={RESILIENCE} layout="vertical" margin={{ top: 0, right: 28, left: 40, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: '#B8A899', fontSize: 11 }} />
            <YAxis type="category" dataKey="attack" width={150} tick={{ fill: '#B8A899', fontSize: 10.5 }} />
            <Tooltip
              contentStyle={{ background: '#1A140E', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 12 }}
              labelStyle={{ color: '#F5E5C7' }}
              formatter={(v) => [`${v}%`, 'Identifier recovered']}
            />
            <Bar dataKey="pct" radius={[0, 3, 3, 0]}>
              {RESILIENCE.map((r) => (
                <Cell key={r.attack} fill={r.pct >= 85 ? '#34d399' : '#f87171'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border/50">
        <strong className="text-foreground">We publish the red bar too.</strong> Audio whose speed or pitch has
        been altered is the hardest case in the entire watermarking field, and the production layers do not
        recover it on an ordinary scan. Dedicated recovery and identification stages target exactly that case
        and are covered below. Benchmarks are ongoing and these figures will move as sample sizes grow.
      </p>
    </div>
  );
}