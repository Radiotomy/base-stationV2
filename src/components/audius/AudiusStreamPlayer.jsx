import { useState } from 'react';
import { VolumeX, ExternalLink } from 'lucide-react';

/**
 * Audius stream player with a graceful restriction fallback.
 * If the artist disables third-party streaming (or the stream URL goes
 * missing/errors), shows a clean message instead of a broken player.
 */
export default function AudiusStreamPlayer({ trackId, isStreamable = true, permalink }) {
  const [restricted, setRestricted] = useState(!isStreamable);
  const streamUrl = `https://discoveryprovider.audius.co/v1/tracks/${trackId}/stream?app_name=BaseStation`;

  if (restricted) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 mb-3">
        <VolumeX className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Streaming restricted</p>
          <p className="text-xs text-muted-foreground">
            The artist has restricted third-party playback of this track outside Audius.
          </p>
        </div>
        {permalink && (
          <a
            href={`https://audius.co${permalink}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 flex-shrink-0"
          >
            Listen on Audius <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  return (
    <audio
      controls
      src={streamUrl}
      onError={() => setRestricted(true)}
      className="w-full rounded-xl mb-3"
    />
  );
}