import { Trophy } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

/** Shown on Protect & Register when this project was started from an Audius remix contest. */
export default function ContestEntryNotice({ contest, enabled, onToggle }) {
  if (!contest) return null;
  const ends = contest.end_date ? new Date(contest.end_date).toLocaleDateString() : null;
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 px-3 py-2 text-sm">
      <span className="flex items-start gap-2 min-w-0">
        <Trophy className="w-4 h-4 mt-0.5 text-accent flex-shrink-0" />
        <span className="min-w-0">
          Enter as a remix in <b>{contest.contest_title}</b>
          <span className="block text-xs text-muted-foreground">
            Credits {contest.parent_artist || 'the host'}'s stems as third-party material{ends && ` · ends ${ends}`}
          </span>
        </span>
      </span>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </label>
  );
}