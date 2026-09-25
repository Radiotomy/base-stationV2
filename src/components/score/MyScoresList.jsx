import { Loader2, FileMusic, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/** Every library track that already has a saved Scribe score. */
export default function MyScoresList({ scores, loading, onOpen }) {
  return (
    <section className="merc-card rounded-2xl p-6 space-y-4">
      <h2 className="text-lg font-bold">My Scores</h2>
      {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
      {!loading && !scores.length && (
        <p className="text-sm text-muted-foreground">No scores yet. Extract one below and it will be saved here.</p>
      )}
      <div className="divide-y divide-border">
        {scores.map((a) => {
          const c = a.metadata.composition;
          return (
            <div key={a.id} className="flex flex-wrap items-center gap-3 py-3">
              <FileMusic className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{a.title}</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {c.key && <Badge variant="secondary">{c.key}</Badge>}
                  {c.tempo_bpm && <Badge variant="secondary">{Math.round(c.tempo_bpm)} BPM</Badge>}
                  {c.transcribed_at && <Badge variant="outline">{new Date(c.transcribed_at).toLocaleDateString()}</Badge>}
                </div>
              </div>
              {c.midi_url && (
                <Button size="sm" variant="outline" onClick={() => window.open(c.midi_url, '_blank')}>
                  <Download className="w-4 h-4 mr-1" /> MIDI
                </Button>
              )}
              <Button size="sm" onClick={() => onOpen(a)}>Open score</Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}