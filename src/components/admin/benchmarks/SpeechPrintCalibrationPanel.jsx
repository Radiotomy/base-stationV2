import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Mic, AlertTriangle } from 'lucide-react';

// Admin-only spoken-word Print calibration. This is the GATE for the podcast
// re-timing path, so the panel is built to make the kill condition obvious
// rather than to make the feature look good: if the strongest unrelated lift
// reaches the genuine range, the seeded path stays advisory permanently.
//
// Unlike the creator-facing card, everything is shown here — lift, beta,
// landmark density — because calibration is meaningless without the numbers.
const parseSources = (text) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [url, ...rest] = l.split(/\s+/);
      return { url, id: rest.join(' ') || url };
    });

export default function SpeechPrintCalibrationPanel() {
  const { toast } = useToast();
  const [freesound, setFreesound] = useState('');
  const [orvo, setOrvo] = useState('');
  const [seconds, setSeconds] = useState(20);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    const res = await base44.functions.invoke('benchmarkBasePrint', {
      action: 'speech_specificity',
      seconds: Number(seconds) || 20,
      freesound_sources: parseSources(freesound),
      orvo_sources: parseSources(orvo),
    });
    setBusy(false);
    if (res.data?.error) return toast({ title: 'Run failed', description: res.data.error, variant: 'destructive' });
    setResult(res.data);
  };

  return (
    <div className="merc-card rounded-2xl p-5 space-y-4">
      <div>
        <p className="text-sm font-black uppercase tracking-widest text-[#FF9A4D] flex items-center gap-2">
          <Mic className="w-4 h-4" /> Spoken-word Print calibration
        </p>
        <p className="text-xs text-white/50 mt-1.5">
          Measures the false-positive floor for BASE Print on speech. Every existing Print figure was
          measured on music at 20 seconds — podcasts are sparser and far longer. Corpora are reported
          separately on purpose; pooling them hides a bad rate behind a good one.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-white/50">
            Freesound / Archive.org speech (one WAV URL per line)
          </label>
          <textarea
            value={freesound}
            onChange={(e) => setFreesound(e.target.value)}
            rows={5}
            placeholder="https://…/speech-a.wav  label A"
            className="mt-1.5 w-full rounded-xl bg-white/5 border border-white/10 p-2.5 text-xs text-white/80 font-mono"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-white/50">
            ORVO back-catalog episodes (one WAV URL per line)
          </label>
          <textarea
            value={orvo}
            onChange={(e) => setOrvo(e.target.value)}
            rows={5}
            placeholder="https://…/episode-1.wav  Show — Ep 1"
            className="mt-1.5 w-full rounded-xl bg-white/5 border border-white/10 p-2.5 text-xs text-white/80 font-mono"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-[11px] text-white/50">Seconds per source</label>
        <input
          type="number"
          value={seconds}
          onChange={(e) => setSeconds(e.target.value)}
          className="w-20 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white"
        />
        <button
          onClick={run}
          disabled={busy}
          className="merc-button rounded-full px-5 py-2 text-sm font-black flex items-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />} Run calibration
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          {(result.corpora || []).map((c) => (
            <div key={c.corpus} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-white/70">{c.corpus}</p>
              {c.error ? (
                <p className="text-xs text-red-300 mt-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> {c.error}
                </p>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-3 mt-3 text-xs">
                    <div>
                      <p className="text-white/40">Strongest unrelated lift</p>
                      <p className="text-white font-bold text-base">{c.summary.strongest_unrelated_lift}</p>
                    </div>
                    <div>
                      <p className="text-white/40">Weakest self lift</p>
                      <p className="text-white font-bold text-base">{c.summary.weakest_self_lift}</p>
                    </div>
                    <div>
                      <p className="text-white/40">False accepts</p>
                      <p className="text-white font-bold text-base">
                        {c.summary.false_accepts_at_provisional_threshold} / {c.cross_matches}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead className="text-white/40">
                        <tr className="text-left">
                          <th className="py-1 pr-3">Source</th>
                          <th className="py-1 pr-3">Bracket</th>
                          <th className="py-1 pr-3">Hash/s</th>
                          <th className="py-1 pr-3">Self lift</th>
                          <th className="py-1 pr-3">Top unrelated</th>
                          <th className="py-1 pr-3">β</th>
                          <th className="py-1">Accepted</th>
                        </tr>
                      </thead>
                      <tbody className="text-white/70">
                        {c.rows.map((r) => (
                          <tr key={r.id} className="border-t border-white/5">
                            <td className="py-1 pr-3 truncate max-w-[10rem]">{r.id}</td>
                            <td className="py-1 pr-3">{r.bracket}</td>
                            <td className="py-1 pr-3">{r.hashes_per_second}</td>
                            <td className="py-1 pr-3">{r.self_lift}</td>
                            <td className="py-1 pr-3">{r.top_unrelated_lift}</td>
                            <td className="py-1 pr-3">{r.top_unrelated_beta}</td>
                            <td className="py-1">
                              {r.top_unrelated_accepted ? (
                                <span className="text-red-300 font-bold">FALSE ACCEPT</span>
                              ) : (
                                <span className="text-emerald-300">abstained</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ))}
          <p className="text-[11px] text-white/40">{result.note}</p>
        </div>
      )}
    </div>
  );
}