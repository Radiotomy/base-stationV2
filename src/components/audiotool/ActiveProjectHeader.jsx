import { Music2, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ActiveProjectHeader({ projectUrl, project, onRefresh }) {
  const { meta, error, title, image, bpm } = project;

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-accent/40 bg-accent/5 p-3">
      {image
        ? <img src={image} alt={title} className="w-24 h-24 sm:w-32 sm:h-20 rounded-xl object-cover flex-shrink-0 border border-border" />
        : <div className="w-24 h-24 sm:w-32 sm:h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0"><Music2 className="w-6 h-6 text-muted-foreground" /></div>}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-emerald-300 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live — BASE Station is controlling this session
        </p>
        <h3 className="text-lg font-bold truncate">
          {meta ? title || 'Untitled project' : error ? 'Connected project' : 'Loading project…'}
        </h3>
        {bpm ? <p className="text-xs text-muted-foreground">{bpm} BPM</p> : null}
        {error && <p className="text-xs text-muted-foreground">Couldn't load project details: {error}</p>}
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0">
        <Button variant="ghost" size="sm" asChild>
          <a href={projectUrl} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5" /> Open</a>
        </Button>
        <Button variant="ghost" size="sm" onClick={onRefresh}><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
      </div>
    </div>
  );
}