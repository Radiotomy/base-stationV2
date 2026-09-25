import { useEffect, useState } from 'react';
import { Activity, Lock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { readLog, computeContribution, subscribeTelemetry } from '@/lib/audiotool/nexusTelemetry';

const Stat = ({ label, value }) => (
  <div className="rounded-xl bg-secondary/60 px-3 py-2">
    <div className="text-lg font-bold">{value}</div>
    <div className="text-[11px] text-muted-foreground">{label}</div>
  </div>
);

export default function NexusContributionMeter({ nexus, projectUrl, counts, onChange }) {
  const { user } = useAuth();
  const [log, setLog] = useState(null);

  useEffect(() => {
    if (!user?.id || !projectUrl) return;
    const load = () => readLog(user.id, projectUrl).then(setLog);
    load();
    return subscribeTelemetry((e) => { if (e.data?.project_url === projectUrl) load(); });
  }, [user?.id, projectUrl]);

  const c = log ? computeContribution(nexus, log) : null;

  useEffect(() => { if (c) onChange?.({ log, contribution: c }); }, [log, counts]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="rounded-2xl border border-border p-5 space-y-3">
      <div>
        <h3 className="font-bold flex items-center gap-2"><Activity className="w-4 h-4" /> Creative Ownership — live</h3>
        <p className="text-sm text-muted-foreground">Every AI call made from this bridge is logged. Everything else in the project counts as yours.</p>
      </div>
      {!c ? (
        <p className="text-sm text-muted-foreground">Loading session telemetry…</p>
      ) : (
        <>
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
        </>
      )}
      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Lock className="w-3 h-3" /> Session telemetry is stored privately on BASE Station servers only — never shared with third parties or data brokers.
      </p>
    </section>
  );
}