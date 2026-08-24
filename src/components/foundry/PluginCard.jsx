import React from 'react';
import { Link } from 'react-router-dom';
import { GitFork, Waves, Globe, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FoundryScoreBadge from './FoundryScoreBadge';
import SendToSubStationButton from '@/components/substation/SendToSubStationButton';

const CATEGORY_COLOR = {
  effect: '#FF9A4D',
  instrument: '#FFC26E',
  utility: '#F5E5C7',
  modulator: '#FF6B4A',
};

export default function PluginCard({ plugin, onFork, forking }) {
  const accent = CATEGORY_COLOR[plugin.category] || '#FF9A4D';
  const nodeCount = plugin.graph_state?.nodes?.length || 0;

  return (
    <div className="merc-card merc-card-hover rounded-2xl p-4 flex flex-col transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link to={`/foundry/${plugin.id}`} className="min-w-0 group">
          <h3 className="text-sm font-semibold text-white/90 truncate group-hover:text-[#FFC98A]">
            {plugin.title}
          </h3>
          <span className="text-[9px] uppercase tracking-widest" style={{ color: accent }}>
            {plugin.category || 'effect'}
          </span>
        </Link>
        <FoundryScoreBadge score={plugin.human_score} label={plugin.participation_signals?.label} compact />
      </div>

      <p className="text-[11px] text-white/45 leading-snug line-clamp-2 flex-1 mb-3">
        {plugin.description || 'No description yet.'}
      </p>

      <div className="flex items-center gap-3 text-[9px] font-mono text-white/30 mb-3">
        <span className="flex items-center gap-1"><Waves className="w-2.5 h-2.5" />{nodeCount} modules</span>
        <span className="flex items-center gap-1"><GitFork className="w-2.5 h-2.5" />{plugin.fork_count || 0}</span>
        <span className="flex items-center gap-1">
          {plugin.is_public ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
          {plugin.is_public ? 'Public' : 'Private'}
        </span>
      </div>

      <div className="flex gap-2">
        <Button asChild size="sm" className="flex-1 h-7 text-[11px] merc-button">
          <Link to={`/foundry/${plugin.id}`}>Open</Link>
        </Button>
        <SendToSubStationButton plugin={plugin} compact />
        {onFork && (
          <Button
            size="sm"
            variant="outline"
            disabled={forking}
            onClick={() => onFork(plugin)}
            className="h-7 px-2 text-[11px] border-white/12"
          >
            <GitFork className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}