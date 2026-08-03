import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const DATA = [
  { format: 'WAV 16-bit', embed: 100, detect: 100 },
  { format: 'WAV 24-bit', embed: 100, detect: 100 },
  { format: 'FLAC', embed: 100, detect: 100 },
  { format: 'MP3 320k', embed: 0, detect: 92 },
  { format: 'MP3 128k', embed: 0, detect: 78 },
  { format: 'OGG', embed: 0, detect: 84 },
  { format: 'M4A / AAC', embed: 0, detect: 82 },
];

export default function FormatSupportChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="font-bold text-foreground text-sm mb-1">File Format Capability</p>
      <p className="text-xs text-muted-foreground mb-4">
        Embedding requires lossless PCM (WAV / FLAC). Lossy formats are decoded to PCM in-browser for
        detection only — reliability depends on encode quality. These lossy detect figures are
        <strong className="text-foreground"> estimates</strong> for the spectral layer, because our benchmark
        runtime cannot run an encoder.
      </p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DATA} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="format" tick={{ fill: '#B8A899', fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis domain={[0, 100]} unit="%" tick={{ fill: '#B8A899', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1A140E', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 12 }}
              labelStyle={{ color: '#F5E5C7' }}
              formatter={(v) => `${v}%`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar name="Embed capability" dataKey="embed" fill="#FF9A4D" radius={[4, 4, 0, 0]} />
            <Bar name="Detect reliability" dataKey="detect" fill="#FFC98A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        Measured counterpart: the V4 Speed Layer container runs real encoders, and recovered the payload
        through genuine MP3, AAC and Opus round trips at 128k — see the Speed Layer results below. Those are
        the only encoder figures on this page that are measured rather than estimated.
      </p>
    </div>
  );
}