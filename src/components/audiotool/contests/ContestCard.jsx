import { useState } from 'react';
import { ChevronDown, ExternalLink, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SendToAudiotoolButton from '@/components/audiotool/songstarter/SendToAudiotoolButton';

export default function ContestCard({ contest }) {
  const [open, setOpen] = useState(false);
  const { track } = contest;
  const ends = contest.end_date ? new Date(contest.end_date).toLocaleDateString() : null;

  return (
    <div className="rounded-xl border border-border p-3 space-y-3">
      <div className="flex gap-3">
        {contest.cover_url
          ? <img src={contest.cover_url} alt={contest.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
          : <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><Trophy className="w-5 h-5 text-muted-foreground" /></div>}
        <div className="min-w-0 flex-1">
          <p className="font-bold truncate">{contest.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {track?.artist}{ends && ` · ends ${ends}`} · {contest.entry_count} entries
            {track?.bpm && ` · ${Math.round(track.bpm)} BPM`}{track?.musical_key && ` · ${track.musical_key}`}
          </p>
          {contest.prize_info && <p className="text-xs text-accent line-clamp-1">Prize: {contest.prize_info}</p>}
        </div>
      </div>
      {contest.description && <p className="text-xs text-muted-foreground line-clamp-2">{contest.description}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
          {contest.stems.length} stems <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </Button>
        {track?.permalink && (
          <Button size="sm" variant="ghost" asChild>
            <a href={track.permalink} target="_blank" rel="noreferrer">Contest on Audius <ExternalLink className="w-3.5 h-3.5" /></a>
          </Button>
        )}
      </div>
      {open && (
        <ul className="space-y-2">
          {contest.stems.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2">
              <span className="text-sm truncate">{s.name}</span>
              <SendToAudiotoolButton url={s.download_url} name={`${s.name} (${contest.title})`} label="Remix in Audiotool" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}