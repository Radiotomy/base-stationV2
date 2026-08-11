import { Zap, BrainCircuit, Gauge, Waves } from 'lucide-react';

// PUBLIC-SAFE architecture diagram. Describes the ROLE and measured behaviour of
// each stage. Underlying engines, parameters, thresholds and detection logic are
// confidential and intentionally absent.
const STAGES = [
  {
    icon: Zap,
    name: 'Instant layer',
    role: 'Live on every track',
    status: 'production',
    body: 'Embedded synchronously the moment a track is saved, with no specialised hardware in the loop. Cheap enough to verify at scale, which is what makes free public verification possible.',
  },
  {
    icon: BrainCircuit,
    name: 'Resilient layer',
    role: 'Live on every track',
    status: 'production',
    body: 'A learned signature applied on top of the first, hardened against the compression and re-encoding that everyday distribution inflicts. It resolves independently — so removing one layer still leaves the other answering.',
  },
  {
    icon: Gauge,
    name: 'Recovery stage',
    role: 'Targeted at altered playback speed',
    status: 'reserve',
    body: 'A dedicated stage aimed at the field\u2019s hardest case: audio whose speed or pitch has been changed. Held as an internal forensic reserve and deliberately kept off the automatic path until its acceptance criteria are fully measured.',
  },
  {
    icon: Waves,
    name: 'Identification stage',
    role: 'Recognition, not attribution',
    status: 'reserve',
    body: 'Recognises a track by its own acoustic geometry rather than by anything embedded in it, so it can identify a copy that has been re-timed. It identifies; it never asserts ownership on its own.',
  },
];

const BADGE = {
  production: { label: 'Live in production', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' },
  reserve: { label: 'Forensic reserve — in measurement', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-400' },
};

export default function PublicLayerDiagram() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <p className="font-semibold text-foreground mb-1">Why more than one signature?</p>
        <p className="text-muted-foreground leading-relaxed">
          Any single watermark has a way to break it. BASE Mark carries complementary technologies on the same
          file, each built to fail differently, so an edit that defeats one leaves another intact. Two run on
          every track today. Two further stages target the field&apos;s hardest remaining case and are held in
          reserve until measurement — not optimism — says they are ready.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {STAGES.map((s) => {
          const Icon = s.icon;
          const badge = BADGE[s.status];
          return (
            <div key={s.name} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-[#FF9A4D] shrink-0" />
                <p className="font-semibold text-foreground text-sm">{s.name}</p>
              </div>
              <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                {badge.label}
              </span>
              <p className="text-[11.5px] text-[#FFC98A]">{s.role}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}