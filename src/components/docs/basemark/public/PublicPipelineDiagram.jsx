import { Music, Fingerprint, FileCheck, Tag, Link2, ScanLine, ArrowDown } from 'lucide-react';

// PUBLIC-SAFE pipeline diagram. Describes WHAT happens to a creator's track and
// in what order. Deliberately contains no timings, block structure, engine names
// or layer parameters.
const STEPS = [
  {
    icon: Music,
    title: 'Create or upload',
    text: 'A track is generated in a studio or uploaded. Creative-participation signals are captured while the work is being made.',
  },
  {
    icon: Fingerprint,
    title: 'Marked automatically on save',
    text: 'The forensic signature is embedded into the waveform the moment the asset is saved. Nothing to enable, no extra step, no cost to the creator.',
  },
  {
    icon: FileCheck,
    title: 'The marked file becomes canonical',
    text: 'Every download, export and distribution copy carries the signature from that point on. The unmarked original is retained in the private provenance record.',
  },
  {
    icon: Tag,
    title: 'Threaded through provenance',
    text: 'The same identifier is written into the track\u2019s embedded tags, its Provenance Manifest and its industry-standard attribution bundle.',
  },
  {
    icon: Link2,
    title: 'Anchored on-chain',
    text: 'A content hash of the marked audio is registered with an immutable timestamp — independent, third-party-verifiable proof of when the work existed.',
  },
  {
    icon: ScanLine,
    title: 'Verifiable by anyone, forever',
    text: 'A file can be checked at any time through the public verifier. If a signature is found, it resolves to the registry record and the creator behind it.',
  },
];

export default function PublicPipelineDiagram() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="font-bold text-foreground text-sm mb-1">From creation to court-ready record</p>
      <p className="text-xs text-muted-foreground mb-5">
        Provenance is applied automatically on the platform&apos;s side. Creators do nothing.
      </p>
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
                  <p className="text-sm font-semibold text-foreground">
                    <span className="text-[#FFC98A] mr-1.5">{i + 1}.</span>{s.title}
                  </p>
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
    </div>
  );
}