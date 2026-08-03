// MEASURED BASE Mark V4 (Speed Layer) results, straight out of smokeBaseMarkV4.
// Nothing here is estimated. Two things make this table worth its own component
// rather than a row in RobustnessChart: it is the FIRST layer to recover a
// re-timed payload at all, and it is the first time we have measured a real
// lossy encoder rather than approximating one with DSP.
//
// Runs: 90s Harmonix EDM/Trap master, 48kHz stereo, unmarked before V4 (so this
// measures V4 standalone, not the cascade). Codec run 2026-08-02, n=1 payload.
const SPEED = [
  { attack: 'Clean round trip (no attack)', pct: 100 },
  { attack: 'Pitch shift +1 semitone (resample)', pct: 100 },
  { attack: '44.1kHz master played at 48kHz', pct: 100 },
  { attack: 'Band-limiting / quantization / noise', pct: 100 },
  { attack: 'Pitch-preserved tempo stretch', pct: 0 },
  { attack: 'Crops under ~5 seconds', pct: 0 },
];

// Real encoders, run inside the container where ffmpeg lives. Each row is an
// encode-and-decode-back round trip, which is what actually happens to a track
// distributed as MP3 and scanned later.
const CODECS = [
  { codec: 'MP3 128k', clean: '0.306', speed: '0.069', ratio: '1.059478' },
  { codec: 'AAC 128k', clean: '0.334', speed: '0.080', ratio: '1.059477' },
  { codec: 'Opus 128k', clean: '0.299', speed: '0.300', ratio: '1.059487' },
];

export default function SpeedLayerResults() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <p className="font-bold text-foreground text-sm mb-1">
          V4 Speed Layer — the first measured recovery of re-timed audio
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          V1, V2 and V3 all measured 0% against resample-based pitch and speed changes. The Speed Layer
          estimates the playback ratio from the signal itself, re-times the audio, and then decodes — so
          it does not need to be told what was done to the file. Measured standalone on a real 48kHz
          stereo master carrying the full 32-bit registry payload.
        </p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {SPEED.map((r) => (
            <div key={r.attack} className="flex items-center justify-between text-xs border-b border-border/40 py-1">
              <span className="text-muted-foreground">{r.attack}</span>
              <span className={`font-bold tabular-nums ${r.pct >= 85 ? 'text-emerald-400' : 'text-red-400'}`}>
                {r.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="font-bold text-foreground text-sm mb-1">Real codec round trips (measured, not approximated)</p>
        <p className="text-xs text-muted-foreground mb-3">
          Every earlier layer was benchmarked against the two <em>measurable components</em> of codec damage
          because our benchmark runtime cannot run an encoder. The Speed Layer runs the encoder in-container,
          so these are genuine MP3/AAC/Opus round trips. Lower bit-error is better; the payload was recovered
          exactly in all six runs, including when codec damage was stacked on top of a pitch shift.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground/70 text-left">
                <th className="py-1.5 pr-3 font-medium">Codec</th>
                <th className="py-1.5 pr-3 font-medium">Bit-error, clean</th>
                <th className="py-1.5 pr-3 font-medium">Bit-error, +1 semitone</th>
                <th className="py-1.5 font-medium">Ratio recovered</th>
              </tr>
            </thead>
            <tbody>
              {CODECS.map((c) => (
                <tr key={c.codec} className="border-t border-border/40">
                  <td className="py-1.5 pr-3 text-foreground">{c.codec}</td>
                  <td className="py-1.5 pr-3 tabular-nums text-emerald-400">{c.clean}</td>
                  <td className="py-1.5 pr-3 tabular-nums text-emerald-400">{c.speed}</td>
                  <td className="py-1.5 tabular-nums text-muted-foreground">{c.ratio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          One master, one payload, 128k only. n=1 per cell — these are early figures, not a robustness rate.
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
        <p className="font-bold text-foreground text-sm mb-2">What these numbers do and don&apos;t establish</p>
        <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
          <li>
            <strong className="text-foreground">Codec damage eats most of the margin.</strong> Genuine
            recoveries now reach a bit-error of ~0.34, while every spurious result across four runs has stayed
            at 0.72 or worse. That separation is what a production acceptance threshold is set from — and it
            is why the threshold sits near 0.45–0.50 rather than lower. A tighter gate would have rejected
            all three genuine codec recoveries above.
          </li>
          <li>
            <strong className="text-foreground">One counterintuitive row, deliberately not spun.</strong> The
            MP3 and AAC pitch-shifted rows scored <em>better</em> than their clean counterparts because the
            speed search happened to land on a cleaner block of audio. That is block-selection luck at n=1,
            not evidence that codec-plus-speed is easier than codec alone.
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