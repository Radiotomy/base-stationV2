import { BrainCircuit, CheckCircle2 } from 'lucide-react';

export default function V2RoadmapBanner() {
  return (
    <div className="merc-card rounded-2xl p-5 text-left space-y-2">
      <div className="flex items-center gap-2">
        <BrainCircuit className="w-5 h-5 text-[#FF9A4D]" />
        <h3 className="font-display text-base">BASE Mark V2 — Neural Watermarking · Live</h3>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-300">
          <CheckCircle2 className="w-3 h-3" /> Available
        </span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        BASE Mark V2 is now live. Embeds run on a private GPU deployment and process asynchronously —
        the first run after idle may take a couple of minutes to cold-start the model, after which the
        marked WAV lands back in your library automatically. V1 acoustic marks continue to protect every
        track, and both layers resolve to the same registry record.
      </p>
    </div>
  );
}