import { FileX, AudioWaveform } from 'lucide-react';

const ROWS = [
  { attack: 'The original file, untouched', hash: true, mark: true },
  { attack: 'Re-encoded to MP3 or AAC for delivery', hash: false, mark: true },
  { attack: 'Volume normalised, EQ\u2019d or re-mastered', hash: false, mark: true },
  { attack: 'Metadata and tags stripped', hash: false, mark: true },
  { attack: 'Cut into a clip, or split into stems', hash: false, mark: true },
  { attack: 'Pitch-shifted or re-timed', hash: false, mark: 'partial' },
];

const Cell = ({ state }) => {
  if (state === 'partial') {
    return <span className="text-[11px] font-bold text-amber-300">Partial</span>;
  }
  return state
    ? <span className="text-[11px] font-bold text-emerald-300">Survives</span>
    : <span className="text-[11px] font-bold text-muted-foreground/60">Breaks</span>;
};

/**
 * Why BASE Station embeds a signature in the audio rather than only hashing the
 * file. A file hash is exact-file-only by design — the moment a track is
 * transcoded for delivery, the hash no longer matches and the record is orphaned.
 * A waveform-embedded mark travels with the sound instead of the container.
 */
export default function HashVsWaveform() {
  return (
    <section className="merc-card rounded-2xl p-6 md:p-8 space-y-5">
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <h2 className="font-display text-2xl text-foreground">
          A file hash proves the file. A BASE Mark proves the audio.
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Most provenance registries record a cryptographic hash of your file. That is a real,
          useful record — but it is exact-file-only by design: change a single byte and the
          fingerprint no longer matches. Music never stays byte-identical, because delivery means
          transcoding. BASE Station registers the hash <em>and</em> embeds an inaudible signature in
          the waveform, so the record still resolves after the file has been through the mill.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[320px]">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2.5 pr-2 sm:pr-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                What happens to the track
              </th>
              <th className="py-2.5 px-2 sm:px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5"><FileX className="w-3.5 h-3.5" /> File hash</span>
              </th>
              <th className="py-2.5 pl-3 text-xs font-bold uppercase tracking-wider text-[#FFC98A] whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5"><AudioWaveform className="w-3.5 h-3.5" /> BASE Mark</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.attack} className="border-b border-border/50 last:border-0">
                <td className="py-2.5 pr-2 sm:pr-4 text-[12px] sm:text-[13px] text-foreground">{r.attack}</td>
                <td className="py-2.5 px-2 sm:px-3"><Cell state={r.hash} /></td>
                <td className="py-2.5 pl-2 sm:pl-3"><Cell state={r.mark} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground/70 leading-relaxed">
        Every row above is a measured result, not a promise. Pitch-shifted and re-timed copies are
        handled by dedicated recovery stages that are still in measurement, and we report them as
        partial rather than solved. Recovering a mark identifies the recording it came from — the
        rest of the evidence trail is still yours to keep.
      </p>
    </section>
  );
}