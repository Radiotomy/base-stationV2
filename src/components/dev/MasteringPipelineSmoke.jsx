import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X } from 'lucide-react';
import { PARAMETRIC_EQ_ZONES, DEFAULT_PARAMETRIC_EQ } from '@/config/parametricEQZones';
import { renderMasteringOffline } from '@/utils/offlineMastering';

const VALID_TYPES = ['lowshelf', 'peaking', 'highshelf'];

// Generate a stereo sine-tone AudioBuffer for pipeline testing
function makeToneBuffer(freq, seconds = 1.2, rate = 44100) {
  const len = Math.floor(rate * seconds);
  const ctx = new OfflineAudioContext(2, len, rate);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = Math.sin(2 * Math.PI * freq * (i / rate)) * 0.3;
  }
  return buf;
}

function rms(buffer) {
  let sum = 0, count = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const d = buffer.getChannelData(ch);
    for (let i = 0; i < d.length; i++) { sum += d[i] * d[i]; count++; }
  }
  return Math.sqrt(sum / count);
}

const FLAT = { character: {}, eq: { ...DEFAULT_PARAMETRIC_EQ }, lufsTarget: -14, stereo: { balance: 0, separation: 0 } };

// Render the same tone with a zone boosted vs cut; the mastered output must differ
async function zoneEfficacy(zoneKey, toneHz) {
  const tone = makeToneBuffer(toneHz);
  const boosted = await renderMasteringOffline(tone, { ...FLAT, eq: { ...DEFAULT_PARAMETRIC_EQ, [zoneKey]: 12 } });
  const cut = await renderMasteringOffline(tone, { ...FLAT, eq: { ...DEFAULT_PARAMETRIC_EQ, [zoneKey]: -12 } });
  const ratio = rms(boosted) / Math.max(rms(cut), 1e-9);
  if (ratio < 1.3) throw new Error(`'${zoneKey}' EQ not reaching render — boost/cut RMS ratio ${ratio.toFixed(2)} (expected > 1.3)`);
  return `ratio ${ratio.toFixed(2)}x`;
}

const TESTS = [
  {
    key: 'config',
    label: 'Zone config integrity (7 zones, valid filters)',
    fn: async () => {
      if (PARAMETRIC_EQ_ZONES.length !== 7) throw new Error(`Expected 7 zones, got ${PARAMETRIC_EQ_ZONES.length}`);
      const keys = new Set();
      let lastFreq = 0;
      for (const z of PARAMETRIC_EQ_ZONES) {
        if (keys.has(z.key)) throw new Error(`Duplicate zone key: ${z.key}`);
        keys.add(z.key);
        if (!VALID_TYPES.includes(z.type)) throw new Error(`Invalid filter type '${z.type}' on ${z.key}`);
        if (!(z.freq > lastFreq)) throw new Error(`Zone freqs not ascending at ${z.key}`);
        if (!(z.q > 0)) throw new Error(`Invalid Q on ${z.key}`);
        lastFreq = z.freq;
        if (!(z.key in DEFAULT_PARAMETRIC_EQ)) throw new Error(`Default EQ missing key ${z.key}`);
      }
      return 'ok';
    },
  },
  {
    key: 'graph',
    label: 'Live-chain node construction + VU analyser path',
    fn: async () => {
      // Mirrors useMasteringChain: EQ filters in series → master gain → splitter → 2 analysers
      const ctx = new OfflineAudioContext(2, 4410, 44100);
      const src = ctx.createBufferSource();
      src.buffer = makeToneBuffer(440, 0.1);
      let cursor = src;
      PARAMETRIC_EQ_ZONES.forEach(z => {
        const f = ctx.createBiquadFilter();
        f.type = z.type; f.frequency.value = z.freq; f.Q.value = z.q; f.gain.value = 6;
        cursor.connect(f); cursor = f;
      });
      const master = ctx.createGain();
      const split = ctx.createChannelSplitter(2);
      const lAna = ctx.createAnalyser(); const rAna = ctx.createAnalyser();
      cursor.connect(master);
      master.connect(split);
      split.connect(lAna, 0); split.connect(rAna, 1);
      master.connect(ctx.destination);
      src.start(0);
      const out = await ctx.startRendering();
      if (rms(out) <= 0) throw new Error('Graph rendered silence');
      return 'ok';
    },
  },
  {
    key: 'nullRender',
    label: 'Flat-EQ render is clean (no NaN, no silence, correct length)',
    fn: async () => {
      const tone = makeToneBuffer(440);
      const out = await renderMasteringOffline(tone, FLAT);
      if (out.length !== tone.length) throw new Error(`Length mismatch: ${out.length} vs ${tone.length}`);
      const d = out.getChannelData(0);
      for (let i = 0; i < d.length; i += 997) {
        if (!Number.isFinite(d[i])) throw new Error(`Non-finite sample at ${i}`);
      }
      if (rms(out) < 0.01) throw new Error('Rendered output is near-silent');
      return 'ok';
    },
  },
  { key: 'lowBass',  label: 'Low Bass zone (55Hz) alters mastered file',   fn: () => zoneEfficacy('lowBass', 55) },
  { key: 'mud',      label: 'Mud zone (350Hz) alters mastered file',       fn: () => zoneEfficacy('mud', 350) },
  { key: 'presence', label: 'Presence zone (3.2kHz) alters mastered file', fn: () => zoneEfficacy('presence', 3200) },
  { key: 'air',      label: 'Air shelf (12kHz) alters mastered file',      fn: () => zoneEfficacy('air', 12000) },
  {
    key: 'isolation',
    label: 'Zone isolation — sub cut leaves 3.2kHz tone intact',
    fn: async () => {
      const tone = makeToneBuffer(3200);
      const flat = await renderMasteringOffline(tone, FLAT);
      const subCut = await renderMasteringOffline(tone, { ...FLAT, eq: { ...DEFAULT_PARAMETRIC_EQ, sub: -12, lowBass: -12 } });
      const ratio = rms(subCut) / Math.max(rms(flat), 1e-9);
      if (ratio < 0.85 || ratio > 1.15) throw new Error(`Low-end cuts leaked into highs — ratio ${ratio.toFixed(2)}`);
      return `ratio ${ratio.toFixed(2)}`;
    },
  },
];

export default function MasteringPipelineSmoke() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState({});

  const runAll = async () => {
    setRunning(true);
    const out = {};
    for (const t of TESTS) {
      const t0 = Date.now();
      try {
        const detail = await t.fn();
        out[t.key] = { status: 'pass', ms: Date.now() - t0, detail };
      } catch (e) {
        out[t.key] = { status: 'fail', ms: Date.now() - t0, error: e?.message || String(e) };
      }
      setResults({ ...out });
    }
    setRunning(false);
  };

  const passed = Object.values(results).filter(r => r.status === 'pass').length;
  const failed = Object.values(results).filter(r => r.status === 'fail').length;

  return (
    <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-black text-foreground">Mastering Pipeline Tests</h3>
          <p className="text-xs text-muted-foreground">7-zone parametric EQ · VU path · offline render efficacy</p>
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(results).length > 0 && (
            <span className="text-xs text-muted-foreground">{passed} pass · {failed} fail</span>
          )}
          <Button onClick={runAll} disabled={running} size="sm" className="rounded-xl gap-1.5">
            {running ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running</> : 'Run mastering tests'}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        {TESTS.map(t => {
          const r = results[t.key];
          return (
            <div key={t.key} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
              <div className="mt-0.5 flex-shrink-0">
                {!r ? <span className="text-xs text-muted-foreground">·</span>
                    : r.status === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                    : <X className="w-3.5 h-3.5 text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground">{t.label}</p>
                {r?.status === 'pass' && r.detail && r.detail !== 'ok' && (
                  <p className="text-xs text-emerald-400/80 mt-0.5">{r.detail}</p>
                )}
                {r?.status === 'fail' && <p className="text-xs text-red-400 mt-0.5 break-all">{r.error}</p>}
              </div>
              {r && <span className="text-[10px] text-muted-foreground">{r.ms}ms</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}