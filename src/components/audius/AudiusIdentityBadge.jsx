import { Headphones, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Compact Audius identity badge showing handle, follower count, and verified status.
 * Reads from user.metadata.audius or artistProfile.metadata.audius.
 */
export default function AudiusIdentityBadge({ audius, compact = false }) {
  if (!audius?.handle) return null;

  if (compact) {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-300 border-0 gap-1">
        <Headphones className="w-3 h-3" />
        @{audius.handle}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
      {audius.profile_picture ? (
        <img src={audius.profile_picture} alt={audius.handle} className="w-10 h-10 rounded-full object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-emerald-500/30 flex items-center justify-center">
          <Headphones className="w-5 h-5 text-emerald-300" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-bold text-sm text-foreground truncate">@{audius.handle}</p>
          {audius.verified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
        </div>
        <p className="text-xs text-muted-foreground">
          {(audius.follower_count || 0).toLocaleString()} followers · {audius.track_count || 0} tracks on Audius
        </p>
      </div>
    </div>
  );
}