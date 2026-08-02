import { Repeat, Ruler, Gauge, Waves } from 'lucide-react';

const Spec = ({ icon: Icon, label }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/10 px-2.5 py-1 text-[11px] text-foreground/80">
    <Icon className="w-3 h-3" />
    {label}
  </span>
);

/**
 * Shows what the finishing stage actually did to a generated loop, so the user
 * can trust it will drop into a DAW without cleanup.
 */
export default function LoopSpecBadges({ info }) {
  if (!info) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {info.seamless && <Spec icon={Repeat} label="Seamless loop" />}
      {info.bars && <Spec icon={Ruler} label={`${info.bars} bar${info.bars === 1 ? '' : 's'}`} />}
      {info.bpm && <Spec icon={Gauge} label={`${info.bpm} BPM`} />}
      <Spec icon={Waves} label={`${(info.sample_rate / 1000).toFixed(1)}kHz · ${info.bit_depth}-bit WAV`} />
      <Spec icon={Gauge} label="Normalized −1 dBFS" />
    </div>
  );
}