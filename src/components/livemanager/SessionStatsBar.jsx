import { Radio, Users, Clock, Film } from 'lucide-react';

export default function SessionStatsBar({ sessions }) {
  const totalSessions = sessions.length;
  const liveNow = sessions.filter(s => s.status === 'streaming').length;
  const totalViewers = sessions.reduce((sum, s) => sum + (s.peak_viewers || 0), 0);
  const totalSeconds = sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
  const hours = (totalSeconds / 3600).toFixed(1);

  const stats = [
    { icon: Film, label: 'Total Sessions', value: totalSessions },
    { icon: Radio, label: 'Live Now', value: liveNow },
    { icon: Users, label: 'Peak Viewers (all-time)', value: totalViewers },
    { icon: Clock, label: 'Hours Streamed', value: hours },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(({ icon: Icon, label, value }) => (
        <div key={label} className="bg-card rounded-2xl border border-border p-4">
          <Icon className="w-4 h-4 text-muted-foreground mb-2" />
          <p className="text-2xl font-black text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}