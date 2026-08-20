import React from 'react';
import { Cpu, User, Sparkles } from 'lucide-react';
import { scoreLabelCopy } from '@/lib/foundry/foundryScore';

const STYLE = {
  human_designed: { icon: User, color: '#C7F5E0' },
  ai_assisted: { icon: Sparkles, color: '#FFC98A' },
  ai_generated: { icon: Cpu, color: '#FFD9A8' },
};

// Design-provenance badge for a PLUGIN. Worded to keep it distinct from an audio
// AI-disclosure label — this describes who built the tool, not who made a record.
export default function FoundryScoreBadge({ score, label, compact = false }) {
  const meta = STYLE[label] || STYLE.ai_generated;
  const Icon = meta.icon;

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-mono"
        style={{ background: 'rgba(255,255,255,0.06)', color: meta.color }}
        title={scoreLabelCopy(label)}
      >
        <Icon className="w-2.5 h-2.5" />
        {score ?? 0}
      </span>
    );
  }

  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] uppercase tracking-widest text-white/40">Design provenance</span>
        <span className="text-sm font-semibold" style={{ color: meta.color }}>{score ?? 0}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3 shrink-0" style={{ color: meta.color }} />
        <span className="text-[10px] text-white/55 leading-snug">{scoreLabelCopy(label)}</span>
      </div>
      <div className="mt-2 h-1 rounded-full bg-white/8 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${score ?? 0}%`, background: 'linear-gradient(to right, #FF9A4D, #FFC98A)' }}
        />
      </div>
    </div>
  );
}