import { FileCheck2, Fingerprint } from 'lucide-react';

/**
 * What makes this studio different from a prompt box: the saved score itself is
 * the authorship record. Shows the server-computed hash so a creator can see
 * there is something concrete behind the claim.
 */
export default function ScoreProvenanceCard({ leadSheet }) {
  if (!leadSheet) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
      <div className="flex items-center gap-2">
        <FileCheck2 className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-black">Score Provenance</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        This score is stored as the human-authored source for every vocal rendered from
        it. The melody is yours note-for-note, so the vocal line's authorship is a
        recorded fact rather than an estimate.
      </p>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="p-2 rounded-lg bg-muted/40">
          <p className="text-muted-foreground">Notes authored</p>
          <p className="font-bold">{leadSheet.score?.length || 0}</p>
        </div>
        <div className="p-2 rounded-lg bg-muted/40">
          <p className="text-muted-foreground">Renders</p>
          <p className="font-bold">{leadSheet.rendered_asset_ids?.length || 0}</p>
        </div>
      </div>

      {leadSheet.score_hash && (
        <div className="p-2 rounded-lg bg-muted/40">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Fingerprint className="w-3 h-3" /> Score hash
          </p>
          <p className="font-mono text-[10px] break-all mt-1">{leadSheet.score_hash}</p>
        </div>
      )}
    </div>
  );
}