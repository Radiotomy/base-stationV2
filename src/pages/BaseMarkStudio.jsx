import { Link } from 'react-router-dom';
import { Fingerprint, BookOpen } from 'lucide-react';
import EmbedMarkCard from '@/components/watermark/EmbedMarkCard';
import EmbedMarkV2Card from '@/components/watermark/EmbedMarkV2Card';
import DetectMarkCard from '@/components/watermark/DetectMarkCard';
import V2RoadmapBanner from '@/components/watermark/V2RoadmapBanner';

export default function BaseMarkStudio() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FF9A4D]/30 bg-[#FF9A4D]/10 px-4 py-1.5 text-sm text-[#FFC98A]">
            <Fingerprint className="w-4 h-4" /> BASE Mark · Unified Dual-Layer Standard
          </div>
          <h1 className="font-display text-3xl md:text-4xl">Watermark & Trace Your Audio</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Embed an inaudible, sample-level watermark directly into your track's waveform.
            Even when metadata is stripped and the audio is cut into stems, sampled or remixed,
            any ~2-second surviving chunk can be traced back to your original track.
          </p>
          <Link to="/docs?section=base-mark" className="inline-flex items-center gap-1.5 text-sm text-[#FFC98A] hover:underline">
            <BookOpen className="w-4 h-4" /> Read the BASE Mark documentation
          </Link>
          <p className="text-xs text-muted-foreground max-w-xl mx-auto">
            Every saved track is automatically stamped with both halves of BASE Mark on the same file: a
            spectral layer embeds instantly, then a neural layer (robust to compression/pitch/time attacks)
            is layered on top on our private GPU. Either layer alone can trace the file back to its registry record.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <EmbedMarkCard />
          <EmbedMarkV2Card />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <DetectMarkCard />
          <div />
        </div>
        <V2RoadmapBanner />
      </div>
    </div>
  );
}