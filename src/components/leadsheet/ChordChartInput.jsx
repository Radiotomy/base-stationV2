import { Textarea } from '@/components/ui/textarea';

/**
 * The progression, as the writer types it. Stored verbatim — normalizing a
 * writer's own notation would replace the artifact being attested to.
 */
export default function ChordChartInput({ value, onChange }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-black">Chord Chart</h3>
        <span className="text-[11px] text-muted-foreground">one bar per <code>|</code></span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder={'C | Am | F | G7\nC | Am | F | G7'}
        className="rounded-xl font-mono text-sm"
      />
      <p className="text-[11px] text-muted-foreground">
        Saved as part of your score's provenance record. Cantor renders the vocal line —
        build the instrumental bed in SUB-Station or your music studio of choice.
      </p>
    </div>
  );
}