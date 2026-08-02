import { useRef, useState } from 'react';
import { Play, Pause, Plus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function LoopCard({
  title, subtitle, audioUrl, tags = [], license, attribution, children,
  onAction, actionLabel, actionIcon: ActionIcon = Plus, actionLoading,
}) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
  };

  return (
    <div className="merc-card rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        {audioUrl && (
          <div className="flex gap-1 shrink-0">
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={toggle}>
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </Button>
            <Button asChild size="icon" variant="outline" className="h-8 w-8" title="Download">
              <a href={audioUrl} download target="_blank" rel="noreferrer">
                <Download className="w-3.5 h-3.5" />
              </a>
            </Button>
          </div>
        )}
      </div>
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 4).map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
          ))}
        </div>
      )}
      {children}
      {license && (
        <p className="text-[10px] text-muted-foreground truncate">
          {license}{attribution ? ` · ${attribution}` : ''}
        </p>
      )}
      {onAction && (
        <Button size="sm" variant="secondary" className="w-full" onClick={onAction} disabled={actionLoading}>
          <ActionIcon className="w-3.5 h-3.5 mr-1.5" /> {actionLoading ? 'Working…' : actionLabel}
        </Button>
      )}
    </div>
  );
}