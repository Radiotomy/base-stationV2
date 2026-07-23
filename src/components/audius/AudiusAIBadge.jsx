import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Shows Audius's opt-in AI attribution: tracks generated with AI based on a
 * consenting artist carry ai_attribution_user_id in the Audius API.
 */
export default function AudiusAIBadge({ track, className = '' }) {
  if (!track?.ai_attribution_user_id) return null;
  return (
    <Badge
      className={`bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs gap-1 ${className}`}
      title="Made with AI — attributed to a consenting Audius artist who opted in to AI training"
    >
      <Sparkles className="w-3 h-3" /> Made with AI
    </Badge>
  );
}