import { ShieldAlert } from 'lucide-react';

/**
 * Non-commercial notice for Cadence beds.
 *
 * Shown at the point the creator has audio in hand and is deciding what to do with
 * it — which is the only moment the restriction can actually change a decision. The
 * same fact is stored on the asset itself, so a bed that travels to a store or
 * distribution surface carries its own restriction rather than relying on a creator
 * remembering this card.
 */
export default function BedLicenseNotice() {
  return (
    <div className="flex gap-2.5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-xs font-bold text-amber-200">Personal & testing use only</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          The bed engine currently runs non-commercial model weights (Meta
          musicgen-melody, CC-BY-NC 4.0). Write, demo and evaluate freely — but don't
          sell this bed, bundle it into paid output or release it commercially until
          we've moved the engine to a cleared checkpoint. Your vocal render and your
          score are unaffected.
        </p>
      </div>
    </div>
  );
}