import { useRef, useEffect, useState } from 'react';
import { Play, Pause, Music, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The venue's stage block: plays whatever the programme clock says is on air, at
 * the position everyone else in the venue is already at.
 *
 * Joining mid-item is the normal case, so the element seeks to the server-derived
 * offset before playing. Playback stays behind a tap because browsers block
 * unprompted audio — an autoplay attempt that silently fails would look like a
 * dead venue.
 */
export default function VenueNowPlayingStage({ nowPlaying, coverFallback, sourceLabel }) {
  const mediaRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const item = nowPlaying?.item;
  const isVideo = item?.media_kind === 'video';
  // Re-keying on the entry forces a fresh element per item, so a new track can
  // never inherit the previous one's playhead.
  const itemKey = `${item?.asset_id || 'none'}-${nowPlaying?.index ?? 0}`;

  const syncToVenue = () => {
    const el = mediaRef.current;
    if (!el) return;
    const offset = Number(nowPlaying?.offset_seconds) || 0;
    if (offset > 0 && Number.isFinite(el.duration) && offset < el.duration) {
      try { el.currentTime = offset; } catch { /* seek unsupported on this source */ }
    }
  };

  // When the programme advances to a new entry while a fan is already listening,
  // keep going without another tap.
  useEffect(() => {
    setPlaying(false);
    const el = mediaRef.current;
    if (!el) return;
    el.load();
  }, [itemKey]);

  const toggle = async () => {
    const el = mediaRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); return; }
    syncToVenue();
    try {
      await el.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  if (!item) {
    return (
      <div className="merc-card rounded-3xl aspect-video flex flex-col items-center justify-center gap-3 text-center px-6">
        {coverFallback
          ? <img src={coverFallback} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 rounded-3xl" />
          : null}
        <Radio className="w-9 h-9 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">This venue is quiet right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="merc-card rounded-3xl overflow-hidden relative">
        {isVideo ? (
          <video
            key={itemKey}
            ref={mediaRef}
            src={item.file_url}
            poster={item.thumbnail_url || coverFallback || undefined}
            className="w-full aspect-video bg-black object-contain"
            playsInline
            controls={playing}
            onLoadedMetadata={syncToVenue}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        ) : (
          <div className="relative aspect-video bg-black flex items-center justify-center">
            {item.thumbnail_url || coverFallback ? (
              <img src={item.thumbnail_url || coverFallback} alt={item.title}
                className="w-full h-full object-cover" />
            ) : (
              <Music className="w-16 h-16 text-white/20" />
            )}
            <audio
              key={itemKey}
              ref={mediaRef}
              src={item.file_url}
              preload="metadata"
              onLoadedMetadata={syncToVenue}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          </div>
        )}

        {!playing && (
          <button type="button" onClick={toggle}
            className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors">
            <span className="w-16 h-16 rounded-full merc-button flex items-center justify-center">
              <Play className="w-7 h-7 ml-0.5" />
            </span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={toggle} size="icon" className="rounded-full w-11 h-11 merc-button flex-shrink-0">
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </Button>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {sourceLabel}
          </p>
          <p className="text-lg font-display truncate">{item.title}</p>
        </div>
      </div>
    </div>
  );
}