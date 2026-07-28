import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// MEASURED data from the BASE Mark attack benchmark (benchmarkBaseMark).
// Every number below came out of that harness — nothing here is estimated.
// Spectral rows: n=3 independent payloads. Neural rows: n=1, measured on a
// genuine cascaded file (spectral embedded first, neural layered on top).
// Source: 44.1kHz mono synthetic broadband material. Run 2026-07-28.
const CASCADE = [
  { attack: 'Untouched file', spectral: 100, neural: 100 },
  { attack: 'Low-pass 15kHz', spectral: 100, neural: 100 },
  { attack: '3s crop', spectral: 100, neural: 100 },
  { attack: 'Pitch shift +1 semitone', spectral: 0, neural: 0 },
  { attack: 'Time stretch +5%', spectral: 0, neural: 0 },
];

// Spectral-layer-only measurements (n=3). The neural layer was not measured for
// these attacks, so no neural figure is published for them.
const SPECTRAL_ONLY = [
  { attack: 'Bit-depth crush to 8-bit', pct: 100 },
  { attack: 'White noise (20dB SNR)', pct: 100 },
  { attack: 'White noise (10dB SNR)', pct: 100 },
  { attack: 'Low-pass 11kHz', pct: 100 },
  { attack: '5s crop', pct: 100 },
  { attack: 'Pitch shift -1 semitone', pct: 0 },
  { attack: 'Pitch shift +2 semitones', pct: 0 },
  { attack: 'Time stretch -5%', pct: 0 },
  { attack: '2s crop', pct: 0 },
];

export default function RobustnessChart() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="font-bold text-foreground text-sm mb-1">Measured payload recovery, by layer</p>
        <p className="text-xs text-muted-foreground mb-4">
          Results from our internal attack benchmark, run against a file carrying both layers
          (spectral embedded first, neural layered on top). Each attack is applied to the finished
          file and both detectors are re-run independently. A payload counts as recovered only if it
          matches the embedded value exactly.
        </p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={CASCADE} layout="vertical" margin={{ top: 0, right: 28, left: 40, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: '#B8A899', fontSize: 11 }} />
              <YAxis type="category" dataKey="attack" width={140} tick={{ fill: '#B8A899', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1A140E', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: '#F5E5C7' }}
                formatter={(v, n) => [`${v}%`, n === 'spectral' ? 'Spectral layer' : 'Neural layer']}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === 'spectral' ? 'Spectral layer' : 'Neural layer')} />
              <Bar dataKey="spectral" fill="#FFC98A" radius={[0, 3, 3, 0]} />
              <Bar dataKey="neural" fill="#FF6B4A" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Spectral n=3 independent payloads; neural n=1. 44.1kHz mono broadband test material.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="font-bold text-foreground text-sm mb-1">Spectral layer — additional attacks</p>
        <p className="text-xs text-muted-foreground mb-3">
          Measured for the spectral layer only (n=3). We have not yet benchmarked the neural layer
          against these, so we publish no neural figure for them.
        </p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {SPECTRAL_ONLY.map((r) => (
            <div key={r.attack} className="flex items-center justify-between text-xs border-b border-border/40 py-1">
              <span className="text-muted-foreground">{r.attack}</span>
              <span className={`font-bold tabular-nums ${r.pct >= 85 ? 'text-emerald-400' : 'text-red-400'}`}>
                {r.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
        <p className="font-bold text-foreground text-sm mb-2">Honest caveats on these numbers</p>
        <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
          <li>
            <strong className="text-foreground">Pitch and tempo changes defeat both layers.</strong> Neither
            the spectral nor the neural layer recovered the payload after a one-semitone pitch shift or a
            5% time stretch. Resampling is the strongest attack we have measured against BASE Mark.
          </li>
          <li>
            <strong className="text-foreground">Crop survival is content-dependent, not a fixed floor.</strong> The
            same 3-second crop recovered 100% from one source and 0% from another, because survival depends on
            the signal level inside the cropped window. Treat short-clip figures as indicative only.
          </li>
          <li>
            <strong className="text-foreground">2-second clips are unreliable and can mis-identify.</strong> At
            2 seconds the spectral detector recovered no correct payload, and in one configuration returned a
            confidently wrong one. Do not rely on clips this short for attribution.
          </li>
          <li>
            <strong className="text-foreground">No real codec in the loop.</strong> We cannot run an MP3/AAC
            encoder in our benchmark environment, so we measure the two measurable components of codec damage —
            band-limiting and quantization — under their own names. We publish no MP3 bitrate figures.
          </li>
          <li>
            <strong className="text-foreground">Synthetic test material.</strong> These runs use generated
            broadband audio, not commercial recordings, and sample sizes are small. Numbers will move as we
            benchmark real music at higher n.
          </li>
        </ul>
      </div>
    </div>
  );
}