import { Play, Pause, SkipBack, SkipForward, Music, Loader2 } from "lucide-react";

export default function PlaylistPlayerBar({ track, isPlaying, isLoading, onToggle, onNext, onPrev }) {
  if (!track) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-lg">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
          {track.cover_image_url
            ? <img src={track.cover_image_url} alt="" className="w-full h-full object-cover" />
            : <Music className="w-4 h-4 m-3 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{track.track_title}</p>
          <p className="text-xs text-muted-foreground truncate">{track.artist_name}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onPrev} aria-label="Previous track"
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors">
            <SkipBack className="w-4 h-4" />
          </button>
          <button onClick={onToggle} aria-label={isPlaying ? "Pause" : "Play"}
            className="w-11 h-11 flex items-center justify-center rounded-full merc-button">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" />
              : isPlaying ? <Pause className="w-5 h-5" fill="currentColor" />
              : <Play className="w-5 h-5 ml-0.5" fill="currentColor" />}
          </button>
          <button onClick={onNext} aria-label="Next track"
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors">
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}