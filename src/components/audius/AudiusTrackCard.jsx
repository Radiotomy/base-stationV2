import { Link } from 'react-router-dom';
import { Play, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import AudiusLicenseBadge from '@/components/audius/AudiusLicenseBadge';

export default function AudiusTrackCard({ track }) {
  const artwork = track.artwork?.['480x480'] || track.artwork?.['150x150'];
  return (
    <Link to={`/audius-track/${track.id}`}
      className="group flex gap-3 p-3 rounded-2xl bg-card border border-border hover:border-emerald-500/30 transition-all">
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
        {artwork ? (
          <img src={artwork} alt={track.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-700 to-teal-900">
            <Play className="w-5 h-5 text-white/40" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-foreground truncate">{track.title}</p>
        <Link to={`/audius-artist/${track.user?.id}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-emerald-400 truncate">
          <User className="w-3 h-3" />
          {track.user?.name || track.user?.handle || 'Unknown'}
        </Link>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {track.genre && <Badge variant="outline" className="text-xs px-1.5 py-0">{track.genre}</Badge>}
          <AudiusLicenseBadge licensing={track.licensing} size="sm" />
          {track.play_count != null && (
            <span className="text-xs text-muted-foreground">{track.play_count.toLocaleString()} plays</span>
          )}
        </div>
      </div>
    </Link>
  );
}