import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';

// MEASURED BASE Mark V4 (Speed Layer) results, straight out of smokeBaseMarkV4.
// Nothing here is estimated. Two things make this its own component rather than
// rows in RobustnessChart: it is the FIRST layer to recover a re-timed payload
// at all, and it is the first time we have measured a real lossy encoder rather
// than approximating one with DSP.
//
// Runs: 90s Harmonix EDM/Trap master, 48kHz stereo, unmarked before V4 (so this
// measures V4 standalone, not the cascade). Codec run 2026-08-02, n=1 payload.
const SPEED = [
  { attack: 'Clean round trip', pct: 100 },
  { attack: 'Pitch +1 semitone (resample)', pct: 100 },
  { attack: '44.1k played at 48k', pct: 100 },
  { attack: 'Band-limit / quantize / noise', pct: 100 },
  { attack: 'Pitch-preserved stretch', pct: 0 },
  { attack: 'Crops under ~5s', pct: 0 },
];

// Real encoders, run inside the container where ffmpeg lives. Each row is an
// encode-and-decode-back round trip — what actually happens to a track
// distributed as MP3 and scanned later. Lower bit-error is better.
const CODEC_ERROR = [
  { codec: 'MP3 128k', clean: 0.306, speed: 0.069 },
  { codec: 'AAC 128k', clean: 0.334, speed: 0.080 },
  { codec: 'Opus 128k', clean: 0.299, speed: 0.300 },
];

const TOOLTIP = {
  contentStyle: { background: '#1A140E', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 12 },
  labelStyle: { color: '#F5E5C7' },
};

export default function SpeedLayerResults() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <p className="font-bold text-foreground text-sm mb-1">
          V4 Speed Layer — the first measured recovery of re-timed audio
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          V1, V2 and V3 all measured 0% against resample-based pitch and speed changes. The Speed Layer
          estimates the playback ratio from the signal itself, re-times the audio, and then decodes — so it
          does not need to be told what was done to the file. Measured standalone on a real 48kHz stereo
          master carrying the full 32-bit registry payload.
        </p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={SPEED} layout="vertical" margin={{ top: 0, right: 28, left: 40, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: '#B8A899', fontSize: 11 }} />
              <YAxis type="category" dataKey="attack" width={150} tick={{ fill: '#B8A899', fontSize: 10.5 }} />
              <Tooltip {...TOOLTIP} formatter={(v) => [`${v}%`, 'Payload recovered']} />
              <Bar dataKey="pct" radius={[0, 3, 3, 0]}>
                {SPEED.map((r) => (
                  <Cell key={r.attack} fill={r.pct >= 85 ? '#34d399' : '#f87171'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          n=1 payload, one 90s master. Recovery counts only an exact match of the full 32-bit payload.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="font-bold text-foreground text-sm mb-1">Real codec round trips (measured, not approximated)</p>
        <p className="text-xs text-muted-foreground mb-4">
          Every earlier layer is benchmarked against the two <em>measurable components</em> of codec damage,
          because our benchmark runtime cannot run an encoder. The Speed Layer runs the encoder in-container,
          so these are genuine MP3/AAC/Opus round trips. The payload was recovered exactly in all six runs —
          including when codec damage was stacked on top of a pitch shift. The chart plots bit-error, so
          <strong className="text-foreground"> lower is better</strong>.
        </p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={CODEC_ERROR} margin={{ top: 4, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="codec" tick={{ fill: '#B8A899', fontSize: 11 }} />
              <YAxis domain={[0, 0.8]} tick={{ fill: '#B8A899', fontSize: 11 }} />
              {/* The bands are the whole point of this chart: genuine recoveries
                  and spurious results occupy separate, non-overlapping ranges,
                  and the gate has to sit between them. */}
              <ReferenceArea y1={0.45} y2={0.5} fill="#fbbf24" fillOpacity={0.16} />
              <ReferenceLine y={0.72} stroke="#f87171" strokeDasharray="4 4" label={{ value: 'spurious floor 0.72', position: 'insideTopRight', fill: '#f87171', fontSize: 10 }} />
              <Tooltip {...TOOLTIP} formatter={(v, n) => [v.toFixed(3), n === 'clean' ? 'Codec only' : 'Codec + pitch shift']} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === 'clean' ? 'Codec only' : 'Codec + pitch shift')} />
              <Bar dataKey="clean" fill="#FFC98A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="speed" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Shaded band = the 0.45–0.50 acceptance window. Dashed line = the lowest bit-error any spurious
          result has produced across four runs. Playback ratio was recovered to five decimals in every
          pitch-shifted row (1.059478 / 1.059477 / 1.059487).
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
        <p className="font-bold text-foreground text-sm mb-2">What these numbers do and don&apos;t establish</p>
        <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
          <li>
            <strong className="text-foreground">Codec damage eats most of the margin.</strong> Genuine
            recoveries now reach a bit-error of ~0.34, while every spurious result across four runs has stayed
            at 0.72 or worse. That separation is what the acceptance threshold is set from — and it is why the
            gate sits at 0.45–0.50 rather than lower. A 0.35 cut would have rejected all three genuine codec
            recoveries above.
          </li>
          <li>
            <strong className="text-foreground">One counterintuitive result, deliberately not spun.</strong> The
            MP3 and AAC pitch-shifted bars score <em>better</em> than their codec-only counterparts because the
            speed search happened to land on a cleaner block of audio. That is block-selection luck at n=1, not
            evidence that codec-plus-speed is easier than codec alone.
          </li>
          <li>
            <strong className="text-foreground">Testing is ongoing.</strong> These runs cover one master, one
            payload and one bitrate. Higher sample counts, more source material, lower bitrates and cascaded
            (V1+V4) configurations are still being measured, and published figures will move as they land.
          </li>
          <li>
            <strong className="text-foreground">Two gaps are unchanged.</strong> Pitch-preserved tempo
            stretching remains unrecoverable by every layer — overlap-add resynthesis is not invertible — and
            very short excerpts are still declined rather than guessed.
          </li>
        </ul>
      </div>
    </div>
  );
}