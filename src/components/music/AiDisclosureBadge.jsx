import { Bot, Wand2 } from 'lucide-react';

const STYLES = {
  ai_generated: { icon: Bot,   text: 'AI Generated', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  ai_assisted:  { icon: Wand2, text: 'AI Assisted',  cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
};

/**
 * RIAA/IFPI-style GenAI disclosure badge.
 * Pass an item with ai_disclosure_label (+ optional ai_disclosure_basis) or a label prop directly.
 */
export default function AiDisclosureBadge({ item, label, size = 'sm' }) {
  const l = label || item?.ai_disclosure_label;
  const s = STYLES[l];
  if (!s) return null;
  const Icon = s.icon;
  const sizeCls = size === 'xs' ? 'text-[9px] px-1.5 py-0' : 'text-[10px] px-2 py-0.5';
  return (
    <span title={item?.ai_disclosure_basis || s.text}
      className={`inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wide ${sizeCls} ${s.cls}`}>
      <Icon className="w-2.5 h-2.5" /> {s.text}
    </span>
  );
}