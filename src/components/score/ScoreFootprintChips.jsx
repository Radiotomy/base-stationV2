import { Badge } from '@/components/ui/badge';
import { Fingerprint } from 'lucide-react';

/** Key, tempo, meter, chords and sections from the composition footprint. */
export default function ScoreFootprintChips({ composition }) {
  if (!composition) return null;
  const sections = composition.sections || [];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {composition.key && <Badge variant="outline">Key: {composition.key}</Badge>}
        {composition.tempo_bpm && <Badge variant="outline">{composition.tempo_bpm} BPM</Badge>}
        {composition.meter && <Badge variant="outline">{composition.meter}</Badge>}
        <Badge variant="outline">{composition.chord_count || 0} chord changes</Badge>
        <Badge variant="outline">{composition.section_count || 0} sections</Badge>
      </div>
      {sections.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Structure: {sections.map((s) => `${s.label} (${Math.round(s.start)}s)`).join(' → ')}
        </p>
      )}
      {composition.footprint_hash && (
        <p className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5">
          <Fingerprint className="w-3 h-3" />
          Composition footprint {composition.footprint_hash.slice(0, 16)}… saved to provenance
        </p>
      )}
    </div>
  );
}