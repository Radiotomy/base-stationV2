import { Rocket, BrainCircuit } from 'lucide-react';

export default function V2RoadmapBanner() {
  return (
    <div className="merc-card rounded-2xl p-5 text-left space-y-2">
      <div className="flex items-center gap-2">
        <BrainCircuit className="w-5 h-5 text-[#FF9A4D]" />
        <h3 className="font-display text-base">BASE Mark V2 — Neural Watermarking · In Development</h3>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#FF9A4D]/30 bg-[#FF9A4D]/10 px-2.5 py-0.5 text-[11px] text-[#FFC98A]">
          <Rocket className="w-3 h-3" /> Next version
        </span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        We're actively building the next generation of BASE Mark: a learned, neural watermark trained to
        survive aggressive compression, pitch-shifting and time-stretching — the attacks that challenge
        every first-generation system. Our GPU inference infrastructure is already connected and
        readiness-tested; V2 ships the moment our model clears internal robustness benchmarks. Until then,
        V1 protects every track automatically, and every V1-marked track remains fully traceable under V2.
      </p>
    </div>
  );
}