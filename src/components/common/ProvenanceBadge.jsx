import { Badge } from '@/components/ui/badge';
import { Sparkles, Mic, Headphones, User } from 'lucide-react';

/**
 * Compact provenance badge — shows the origin of a track at a glance.
 * Used on TrackCard, chart entries, radio queue, etc.
 *
 * origin: 'audius' | 'community' | 'creator' | 'ai'
 * provider: optional AI provider name (sonic, nuro, tempcolor…)
 * model: optional model version
 */
const ORIGIN_STYLES = {
  audius:    { label: 'Audius',    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',  icon: Headphones },
  community: { label: 'Community', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',           icon: User },
  creator:   { label: 'Creator',   cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30',     icon: User },
  ai:        { label: 'AI',        cls: 'bg-pink-500/15 text-pink-300 border-pink-500/30',           icon: Sparkles },
  vocal:     { label: 'Vocal',     cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',        icon: Mic },
};

export default function ProvenanceBadge({ origin = 'creator', provider, model, size = 'sm', className = '' }) {
  const style = ORIGIN_STYLES[origin] || ORIGIN_STYLES.creator;
  const Icon = style.icon;
  const isXs = size === 'xs';
  const label = provider
    ? `${style.label} · ${provider}${model ? ` ${model}` : ''}`
    : style.label;

  return (
    <Badge
      title={`Origin: ${label}`}
      className={`inline-flex items-center gap-1 border font-semibold ${style.cls} ${isXs ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'} ${className}`}
    >
      <Icon className={isXs ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      <span className="truncate max-w-[140px]">{label}</span>
    </Badge>
  );
}