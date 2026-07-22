import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';

const DATA = [
  { attack: 'Untouched file', survival: 99 },
  { attack: 'Cut ≥ 10s', survival: 98 },
  { attack: '5s clip', survival: 95 },
  { attack: '3s clip', survival: 88 },
  { attack: '2s clip', survival: 68 },
  { attack: '< 2s clip', survival: 0 },
  { attack: 'Stem split / remix', survival: 85 },
  { attack: 'MP3 320k re-encode', survival: 90 },
  { attack: 'MP3 128k re-encode', survival: 74 },
  { attack: 'Pitch shift ±1st', survival: 22 },
  { attack: 'Time stretch ±5%', survival: 15 },
];

const color = (v) => (v >= 85 ? '#4ADE80' : v >= 60 ? '#FF9A4D' : '#F87171');

export default function RobustnessChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="font-bold text-foreground text-sm mb-1">Watermark Survival by Manipulation</p>
      <p className="text-xs text-muted-foreground mb-4">
        Estimated payload recovery rates from internal testing. The full payload repeats every ~0.77s
        block — any surviving contiguous chunk of ~2 seconds or more can still carry the complete identifier.
        Clips under 2 seconds physically cannot contain a full payload.
      </p>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DATA} layout="vertical" margin={{ top: 0, right: 28, left: 40, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: '#B8A899', fontSize: 11 }} />
            <YAxis type="category" dataKey="attack" width={110} tick={{ fill: '#B8A899', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1A140E', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 12 }}
              labelStyle={{ color: '#F5E5C7' }}
              formatter={(v) => [`${v}%`, 'Survival']}
            />
            <Bar dataKey="survival" radius={[0, 4, 4, 0]}>
              {DATA.map((d) => <Cell key={d.attack} fill={color(d.survival)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#4ADE80] mr-1.5" />High confidence</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#FF9A4D] mr-1.5" />Degraded</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#F87171] mr-1.5" />Unreliable / broken</span>
      </div>
    </div>
  );
}