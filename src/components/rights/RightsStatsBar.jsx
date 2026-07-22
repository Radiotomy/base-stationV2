import { ShieldCheck, Fingerprint, Hash, FileAudio } from 'lucide-react';

export default function RightsStatsBar({ assets }) {
  const scored = assets.filter(a => a.human_participation_score != null);
  const avg = scored.length ? Math.round(scored.reduce((s, a) => s + a.human_participation_score, 0) / scored.length) : 0;
  const stats = [
    { icon: FileAudio, label: 'Protected Assets', value: assets.length },
    { icon: ShieldCheck, label: 'Avg. Ownership Score', value: scored.length ? `${avg}` : '—' },
    { icon: Fingerprint, label: 'BASE Marked', value: assets.filter(a => a.metadata?.base_mark?.payload_hex).length },
    { icon: Hash, label: 'Hash Anchored', value: assets.filter(a => a.c2pa_provenance_hash).length },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(({ icon: Icon, label, value }) => (
        <div key={label} className="merc-card rounded-2xl p-4">
          <Icon className="w-4 h-4 text-[#FF9A4D] mb-2" />
          <p className="text-2xl font-black text-foreground">{value}</p>
          <p className="text-[11px] text-muted-foreground font-semibold">{label}</p>
        </div>
      ))}
    </div>
  );
}