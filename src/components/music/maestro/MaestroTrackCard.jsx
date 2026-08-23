import { CheckCircle, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Status of the track Maestro committed — composing, then playable.
export default function MaestroTrackCard({ status, audioUrl, title, error }) {
  if (!status) return null;

  if (error) {
    return (
      <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-300">{error}</div>
    );
  }

  if (!audioUrl) {
    return (
      <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
        <p className="text-xs text-blue-300">Generating "{title || 'your track'}" — the studio is composing it now.</p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-emerald-500/30 bg-card space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-bold text-emerald-400">Track ready</span>
        {title && <span className="text-xs text-muted-foreground truncate">"{title}"</span>}
      </div>
      <audio controls className="w-full rounded-xl" src={audioUrl} />
      <a href={audioUrl} download>
        <Button variant="outline" size="sm" className="gap-2 rounded-lg text-xs">
          <Download className="w-3.5 h-3.5" /> Download
        </Button>
      </a>
    </div>
  );
}