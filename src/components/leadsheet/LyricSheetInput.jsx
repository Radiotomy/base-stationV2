import { Textarea } from '@/components/ui/textarea';

/**
 * The readable lyric. Kept alongside the melody even though the melody carries
 * its own syllables — the lyric is the work, the melody is the sung breakdown.
 */
export default function LyricSheetInput({ value, onChange }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-black">Lyric Sheet</h3>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder={'Verse 1\nTwinkle twinkle little star…'}
        className="rounded-xl text-sm"
      />
    </div>
  );
}