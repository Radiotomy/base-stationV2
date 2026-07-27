import { BrainCircuit, CheckCircle2 } from 'lucide-react';

export default function V2RoadmapBanner() {
  return (
    <div className="merc-card rounded-2xl p-5 text-left space-y-2">
      <div className="flex items-center gap-2">
        <BrainCircuit className="w-5 h-5 text-[#FF9A4D]" />
        <h3 className="font-display text-base">BASE Mark Cascade — V1 + V2 · Live</h3>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-300">
          <CheckCircle2 className="w-3 h-3" /> Available
        </span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Every new track is now stamped with <strong className="text-foreground">both</strong> watermark layers,
        cascaded on the same file: the V1 acoustic mark is embedded first (instant, no GPU needed), then the V2
        neural mark is layered on top asynchronously — the first run after idle may take a couple of minutes to
        cold-start the model. We verified end-to-end that neither layer disturbs the other: V1 still resolves
        after V2 is embedded, and V2 resolves independently. If an attacker defeats one layer, the other still
        traces the file back to its registry record.
      </p>
    </div>
  );
}