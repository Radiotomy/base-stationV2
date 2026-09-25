import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { readLog, computeContribution, TELEMETRY_EVENT } from '@/lib/audiotool/nexusTelemetry';

const Stat = ({ label, value }) => (
  <div className="rounded-xl bg-secondary/60 px-3 py-2">
    <div className="text-lg font-bold">{value}</div>
    <div className="text-[11px] text-muted-foreground">{label}</div>
  </div>
);

export default function NexusContributionMeter({ nexus, projectUrl, counts, onChange }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(TELEMETRY_EVENT, bump);
    return () => window.removeEventListener(TELEMETRY_EVENT, bump);
  }, []);

  const log = readLog(projectUrl);
  const c = computeContribution(nexus, log);

  useEffect(() => { onChange?.({ log, contribution: c }); }, [tick, counts, projectUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="rounded-2xl border border-border p-5 space-y-3">
      <div>
        <h3 className="font-bold flex items-center gap-2"><Activity className="w-4 h-4" /> Creative Ownership — live</h3>
        <p className="text-sm text-muted-foreground">Every AI call made from this bridge is logged. Everything else in the project counts as yours.</p>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className="h-full bg-emerald-400 transition-all" style={{ width: `${c.humanShare ?? 0}%` }} />
      </div>
      <p className="text-sm">
        {c.humanShare === null ? 'No notes or devices in this project yet.' : `${c.humanShare}% human-made · ${100 - c.humanShare}% AI-written`}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Your notes" value={c.humanNotes} />
        <Stat label="AI notes" value={c.aiNotes} />
        <Stat label="Your devices" value={c.humanDevices} />
        <Stat label="AI devices" value={c.aiDevices} />
        <Stat label="AI invocations" value={c.invocations} />
      </div>
    </section>
  );
}