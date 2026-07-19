import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/**
 * "What should I do next?" nudge — suggests the most useful next action
 * for an asset based on what it's missing.
 */
export default function NextStepNudge({ asset }) {
  const m = asset.metadata || {};
  let nudge = null;

  if (asset.asset_type === 'track') {
    if (!asset.thumbnail_url) {
      nudge = { emoji: '🎨', label: 'Add cover art', to: `/cover-art-studio?assetId=${asset.id}` };
    } else if (!m.registered_on_base && !m.base_tx_hash) {
      nudge = { emoji: '🛡️', label: 'Register ownership on-chain (free)', to: '/creator-dashboard?tab=proof' };
    }
  } else if (asset.asset_type === 'lyric') {
    nudge = { emoji: '🎵', label: 'Turn these lyrics into a track', to: `/music-studio?assetId=${asset.id}` };
  } else if (asset.asset_type === 'stem') {
    nudge = { emoji: '🔀', label: 'Blend into a mashup', to: `/mashup-studio?assetId=${asset.id}` };
  }

  if (!nudge) return null;

  return (
    <Link
      to={nudge.to}
      title="Suggested next step for this asset"
      className="mx-4 mb-3 flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-amber-500/25 hover:border-amber-500/40 transition-all group"
      style={{ backgroundColor: 'rgba(245,158,11,0.08)' }}
    >
      <span className="text-xs font-semibold text-amber-300">
        <span className="font-mono text-[9px] uppercase tracking-wider text-amber-400/70 mr-2">Next step</span>
        {nudge.emoji} {nudge.label}
      </span>
      <ArrowRight className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
    </Link>
  );
}