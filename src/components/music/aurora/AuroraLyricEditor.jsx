import InfoTip from '@/components/common/InfoTip';
import { SECTION_TAGS } from '@/lib/music/auroraCaption';

/**
 * Lyric editor for Aurora. MiniMax-Music3 reads bracketed section tags as
 * written, each on its own line, and uses them to lay out the song's structure —
 * so the tags are offered as one-click inserts rather than left for the creator
 * to remember and mistype. Unlike Skye's DiffRhythm parser there is no token
 * rewriting anywhere in this path: what is typed here is what the model reads.
 */
export default function AuroraLyricEditor({ value, onChange, disabled }) {
  const insert = (tag) => {
    const needsBreak = value && !value.endsWith('\n');
    onChange(`${value}${needsBreak ? '\n' : ''}${tag}\n`);
  };

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
        Lyrics (Optional)
        <InfoTip text="Put each section tag on its own line — Aurora uses them to build the song's structure. Leave the whole field blank, or use only [Instrumental], for an instrumental track." />
      </p>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {SECTION_TAGS.map((tag) => (
          <button key={tag} type="button" onClick={() => insert(tag)} disabled={disabled}
            className="px-2 py-1 rounded-lg border border-border bg-card/60 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-amber-500/40 transition-colors disabled:opacity-50">
            {tag}
          </button>
        ))}
      </div>

      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={10} disabled={disabled}
        placeholder={'[Intro]\n\n[Verse]\nMorning light filtering through the pine\nEvery quiet street is yours and mine\n\n[Chorus]\nSoftly the world begins to breathe'}
        className="w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none font-mono" />
    </div>
  );
}