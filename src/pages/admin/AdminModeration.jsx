import { useState } from 'react';
import ReportQueue from '@/components/admin/moderation/ReportQueue';
import FlagQueue from '@/components/admin/moderation/FlagQueue';

const TABS = [
  { key: 'reports', label: 'Content Reports', hint: 'Listener reports on podcasts, episodes and comments' },
  { key: 'flags', label: 'Transparency Registry', hint: 'False-flag reports filed by creators against DSPs' },
];

export default function AdminModeration() {
  const [tab, setTab] = useState('reports');
  const active = TABS.find((t) => t.key === tab);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-black text-foreground mb-1">Moderation</h1>
        <p className="text-muted-foreground text-sm">{active.hint}</p>
      </div>

      <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit mb-6">
        {TABS.map((t) => (
          <button
            key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${tab === t.key ? 'bg-purple-500/20 text-purple-300' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'reports' ? <ReportQueue /> : <FlagQueue />}
    </div>
  );
}