import { BrainCircuit, CheckCircle2 } from 'lucide-react';

export default function V2RoadmapBanner() {
  return (
    <div className="merc-card rounded-2xl p-5 text-left space-y-2">
      <div className="flex items-center gap-2">
        <BrainCircuit className="w-5 h-5 text-[#FF9A4D]" />
        <h3 className="font-display text-base">BASE Mark — Layered Forensic Protocol · Live</h3>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-300">
          <CheckCircle2 className="w-3 h-3" /> Available
        </span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        BASE Mark is one signature made of layered parts, stamped on every new track automatically: a spectral
        layer embeds instantly with no GPU needed, and a neural layer is embedded on top asynchronously —
        the first run after idle may take a couple of minutes to cold-start the model. We verified end-to-end
        that neither layer disturbs the other: each resolves independently to the same registry record even
        after the other is embedded on top, so if an attacker defeats one, the other still traces the file back.
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Beyond the two production layers, the protocol includes a deep scan that recovers marks from resampled
        or pitch-shifted copies by realigning the audio before detection, and a fingerprint-guided recovery
        stage — currently in measurement — that estimates how a file was re-timed and seeds the scan with it.
        Where evidence is insufficient, every stage reports "no result" rather than a low-confidence guess.
      </p>
    </div>
  );
}