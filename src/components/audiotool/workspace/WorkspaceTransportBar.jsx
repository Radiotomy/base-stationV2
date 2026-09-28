import { Link } from 'react-router-dom';
import { ArrowLeft, Play, RefreshCw, Columns2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WORKSPACE_LIST, withProject } from '@/lib/audiotool/workspaces';

export default function WorkspaceTransportBar({ workspace, projectUrl, meta, connected, onRefresh, splitOpen, onToggleSplit }) {
  const Icon = workspace.icon;
  return (
    <div className="border-b border-border bg-background/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={withProject('/audiotool', projectUrl)}><ArrowLeft className="w-4 h-4" /> Bridge</Link>
        </Button>
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-2xl merc-bubble flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-background relative z-10" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{workspace.label}</p>
            <p className="font-bold truncate max-w-[14rem] sm:max-w-xs">{meta.title || 'Untitled project'}</p>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-1 ml-4">
          {WORKSPACE_LIST.filter((w) => w.key !== workspace.key).map((w) => (
            <Link key={w.key} to={withProject(w.to, projectUrl)}
              className="text-xs rounded-full px-3 py-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              {w.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 ml-auto">
          {meta.bpm && <span className="font-mono text-xs rounded-full border border-border px-3 py-1">{meta.bpm} BPM</span>}
          <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-300' : 'text-destructive'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-destructive'}`} />
            {connected ? 'Live' : 'Reconnecting…'}
          </span>
          <Button variant="ghost" size="icon" onClick={onRefresh} aria-label="Refresh session"><RefreshCw className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" className="rounded-full" onClick={onToggleSplit}
            title="Opens your live Audiotool studio in a window docked right next to BASE Station, so you hear playback while you edit here">
            <Columns2 className="w-3.5 h-3.5" /> Side-by-side
          </Button>
          <Button size="sm" className="merc-button rounded-full" asChild>
            <a href={projectUrl} target="_blank" rel="noreferrer"><Play className="w-3.5 h-3.5" /> Play in Audiotool</a>
          </Button>
        </div>
      </div>
    </div>
  );
}