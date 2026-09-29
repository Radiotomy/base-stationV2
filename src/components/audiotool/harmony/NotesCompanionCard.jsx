import { ExternalLink, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Audiotool's NOTES (Harmony Editor) joins the same live project as a peer — its chords land on this timeline. */
export default function NotesCompanionCard({ projectUrl }) {
  return (
    <section className="rack-module space-y-3">
      <h3 className="font-bold flex items-center gap-2"><Music2 className="w-4 h-4" /> Open in NOTES</h3>
      <p className="text-sm text-muted-foreground">
        Audiotool's Harmony Editor works on the same live project. Open it, pick this project, and anything it writes appears here instantly.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="merc-button" asChild>
          <a href="https://audiotool.github.io/HarmonyEditor/" target="_blank" rel="noreferrer">Open NOTES <ExternalLink className="w-3.5 h-3.5" /></a>
        </Button>
        {projectUrl && (
          <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(projectUrl)}>Copy project link</Button>
        )}
      </div>
    </section>
  );
}