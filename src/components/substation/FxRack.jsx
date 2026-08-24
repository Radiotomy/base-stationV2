import { Slider } from '@/components/ui/slider';
import InfoTip from '@/components/common/InfoTip';

function Row({ label, value, min, max, step, unit, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono uppercase text-white/40 w-16 shrink-0">{label}</span>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} className="flex-1" />
      <span className="text-[9px] font-mono text-[#14b8a6] w-12 text-right tabular-nums">
        {typeof value === 'number' ? value.toFixed(step < 1 ? 2 : 0) : value}{unit}
      </span>
    </div>
  );
}

function Unit({ title, tip, children }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF9A4D]">{title}</span>
        <InfoTip size="sm" text={tip} />
      </div>
      {children}
    </div>
  );
}

export default function FxRack({ fx, onChange }) {
  const set = (group, key, v) => onChange({ ...fx, [group]: { ...fx[group], [key]: v } });

  return (
    <div className="space-y-2">
      <Unit title="Parametric EQ" tip="Three-band shelving and peaking EQ on the master bus. Applies to live playback and to every bounce.">
        <Row label="Low" value={fx.eq.low} min={-18} max={18} step={0.5} unit="dB" onChange={v => set('eq', 'low', v)} />
        <Row label="Mid" value={fx.eq.mid} min={-18} max={18} step={0.5} unit="dB" onChange={v => set('eq', 'mid', v)} />
        <Row label="Mid Freq" value={fx.eq.midFreq} min={200} max={6000} step={10} unit="Hz" onChange={v => set('eq', 'midFreq', v)} />
        <Row label="High" value={fx.eq.high} min={-18} max={18} step={0.5} unit="dB" onChange={v => set('eq', 'high', v)} />
      </Unit>

      <Unit title="Feedback Delay" tip="Tempo-independent delay send. Feedback is capped below unity so the line can never run away.">
        <Row label="Time" value={fx.delay.time} min={0.02} max={1.5} step={0.01} unit="s" onChange={v => set('delay', 'time', v)} />
        <Row label="Feedback" value={fx.delay.feedback} min={0} max={0.85} step={0.01} unit="" onChange={v => set('delay', 'feedback', v)} />
        <Row label="Mix" value={fx.delay.mix} min={0} max={1} step={0.01} unit="" onChange={v => set('delay', 'mix', v)} />
      </Unit>

      <Unit title="Room Reverb" tip="Convolution reverb built from a generated impulse. Larger sizes rebuild the impulse, which briefly costs CPU.">
        <Row label="Size" value={fx.reverb.size} min={0.3} max={6} step={0.1} unit="s" onChange={v => set('reverb', 'size', v)} />
        <Row label="Mix" value={fx.reverb.mix} min={0} max={1} step={0.01} unit="" onChange={v => set('reverb', 'mix', v)} />
      </Unit>

      <Unit title="Compressor" tip="Dynamic compressor before the limiter — it shapes the mix, the limiter only catches peaks.">
        <Row label="Threshold" value={fx.comp.threshold} min={-60} max={0} step={1} unit="dB" onChange={v => set('comp', 'threshold', v)} />
        <Row label="Ratio" value={fx.comp.ratio} min={1} max={20} step={0.1} unit=":1" onChange={v => set('comp', 'ratio', v)} />
        <Row label="Attack" value={fx.comp.attack} min={0} max={0.3} step={0.005} unit="s" onChange={v => set('comp', 'attack', v)} />
        <Row label="Release" value={fx.comp.release} min={0.02} max={1} step={0.01} unit="s" onChange={v => set('comp', 'release', v)} />
      </Unit>

      <Unit title="Master Limiter" tip="Final ceiling on the master bus. The bounce renders through this same setting, so what you hear is what exports.">
        <Row label="Ceiling" value={fx.limiter.ceiling} min={-12} max={0} step={0.1} unit="dB" onChange={v => set('limiter', 'ceiling', v)} />
      </Unit>
    </div>
  );
}