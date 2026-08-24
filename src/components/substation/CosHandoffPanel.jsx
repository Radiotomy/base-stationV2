import { Check, X, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import InfoTip from '@/components/common/InfoTip';
import { manifestReadiness } from '@/lib/substation/manifest';

const LABELS = [
  { id: 'human', label: 'Human' },
  { id: 'ai_assisted', label: 'AI-assisted' },
  { id: 'ai_generated', label: 'AI-generated' },
];

export default function CosHandoffPanel({ session, patchMeta }) {
  const checks = manifestReadiness(session);
  const ready = checks.every(c => c.ok);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF9A4D]">COS Handoff Status</span>
        <InfoTip size="sm" text="What BASE Station's Content Ownership System needs before it can ingest this arrangement. The manifest records declarations — it never asserts a provenance finding on its own." />
      </div>

      <div className="space-y-1.5">
        <div>
          <label className="text-[9px] font-mono uppercase text-white/40">Project title</label>
          <Input value={session.meta.title} onChange={(e) => patchMeta({ title: e.target.value })}
            placeholder="Title for the COS record"
            className="h-7 text-[11px] bg-black/40 border-white/10 mt-0.5" />
        </div>
        <div>
          <label className="text-[9px] font-mono uppercase text-white/40">Genre</label>
          <Input value={session.meta.genre} onChange={(e) => patchMeta({ genre: e.target.value })}
            placeholder="Optional"
            className="h-7 text-[11px] bg-black/40 border-white/10 mt-0.5" />
        </div>
        <div>
          <label className="text-[9px] font-mono uppercase text-white/40">AI disclosure</label>
          <div className="flex gap-1 mt-0.5">
            {LABELS.map(l => (
              <button key={l.id} onClick={() => patchMeta({ ai_label: l.id })}
                className={`flex-1 h-7 rounded text-[10px] font-mono border ${
                  session.meta.ai_label === l.id
                    ? 'border-[#14b8a6] text-[#14b8a6] bg-[#14b8a6]/10'
                    : 'border-white/12 text-white/45 hover:text-white/70'
                }`}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/30 p-2 space-y-1">
        {checks.map(c => (
          <div key={c.id} className="flex items-center gap-2">
            {c.ok
              ? <Check className="w-3 h-3 text-[#14b8a6] shrink-0" />
              : <X className="w-3 h-3 text-[#fb7185] shrink-0" />}
            <span className={`text-[10px] ${c.ok ? 'text-white/60' : 'text-white/40'}`}>{c.label}</span>
          </div>
        ))}
      </div>

      <div className={`rounded-lg border p-2 flex items-center gap-2 ${
        ready ? 'border-[#14b8a6]/40 bg-[#14b8a6]/8' : 'border-white/10 bg-black/30'
      }`}>
        <ShieldCheck className={`w-4 h-4 ${ready ? 'text-[#14b8a6]' : 'text-white/30'}`} />
        <p className="text-[10px] leading-snug" style={{ color: ready ? '#14b8a6' : 'rgba(255,255,255,0.45)' }}>
          {ready
            ? 'Metadata complete — the export manifest is ready for COS ingestion and BASE Mark.'
            : 'Complete the checks above to produce an ingestible manifest.'}
        </p>
      </div>
    </div>
  );
}