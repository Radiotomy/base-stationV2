import { Music, Save, Fingerprint, FileCheck, Tag, FileText, Link2, ArrowDown } from 'lucide-react';

const STEPS = [
  { icon: Music, title: '1. Generate / Upload', text: 'Track is created in a studio or uploaded. COS telemetry signals are collected during creation.' },
  { icon: Save, title: '2. Save to Library', text: 'Asset record is created with participation score, AI disclosure label, and DDEX attribution profile.' },
  { icon: Fingerprint, title: '3. Auto BASE Mark — V1 then V2', text: 'The watermark automation fires on save: the spectral layer embeds the 32-bit payload synchronously (~0.77s repeating blocks), then the neural layer is embedded on top of that file on GPU.' },
  { icon: FileCheck, title: '4. Marked File Becomes Canonical', text: 'The watermarked file replaces the original in the asset — all downloads, distribution, and exports now carry the mark.' },
  { icon: Tag, title: '5. ID3 Provenance Tagging', text: 'MP3 exports are tagged with COS score, disclosure label, DDEX flags, manifest URL, and the BASE Mark payload (TXXX frames).' },
  { icon: FileText, title: '6. Manifest + DDEX Export', text: 'The live COS Manifest and DDEX bundle both include the watermark payload — all provenance layers cross-reference each other.' },
  { icon: Link2, title: '7. On-Chain Anchor', text: 'Registration hashes the actual audio bytes (SHA-256) of the marked file, pins the manifest to IPFS, and anchors both on Base mainnet.' },
];

export default function PipelineFlowChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="font-bold text-foreground text-sm mb-4">Provenance Pipeline — Order of Operations</p>
      <div className="space-y-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.title}>
              <div className="flex gap-3 items-start">
                <div className="w-9 h-9 rounded-lg merc-bubble flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#14100C] relative z-10" />
                </div>
                <div className="pb-1">
                  <p className="text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="text-[12.5px] text-muted-foreground leading-relaxed">{s.text}</p>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex justify-start pl-3.5 py-1">
                  <ArrowDown className="w-4 h-4 text-[#FF9A4D]/60" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground mt-4 pt-3 border-t border-border/50">
        The V3 Drift Layer was removed from this pipeline in August 2026 — it never reached the default path
        and carried no recoverable identities. The V4 Speed Layer is deliberately absent too: it is in
        benchmarking, admin-only, and does not touch a creator&apos;s asset. It joins the pipeline only once
        the acceptance threshold is enforced in the registry lookup.
      </p>
    </div>
  );
}