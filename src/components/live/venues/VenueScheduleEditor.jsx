import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, CalendarClock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TZ = 'America/Chicago';

/**
 * Weekly time blocks that override the venue's default loop.
 *
 * Times are written and shown in the venue's own timezone — a block called
 * "mornings" has to mean morning where the artist is, and UTC would drift it
 * twice a year with daylight saving.
 */
export default function VenueScheduleEditor({ venue, playlists, schedules, onChanged }) {
  const [draft, setDraft] = useState({ label: '', playlist_id: '', days: [], start_time: '09:00', end_time: '12:00' });
  const [busy, setBusy] = useState(false);

  const toggleDay = (d) =>
    setDraft((s) => ({ ...s, days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d].sort() }));

  const add = async () => {
    if (!draft.playlist_id) { toast.error('Pick a programme for this block'); return; }
    setBusy(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.VenueSchedule.create({
        venue_id: venue.id,
        user_id: user.id,
        playlist_id: draft.playlist_id,
        label: draft.label.trim() || 'Scheduled block',
        days_of_week: draft.days,
        start_time: draft.start_time,
        end_time: draft.end_time,
        timezone: TZ,
      });
      setDraft({ label: '', playlist_id: '', days: [], start_time: '09:00', end_time: '12:00' });
      onChanged?.();
      toast.success('Block scheduled');
    } catch (err) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  const remove = async (id) => {
    try {
      await base44.entities.VenueSchedule.delete(id);
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const nameFor = (id) => playlists.find((p) => p.id === id)?.title || 'Deleted programme';

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-accent" />
        <p className="font-bold text-foreground text-sm">Scheduled blocks</p>
        <Badge variant="outline" className="text-[10px] ml-auto">{TZ.split('/')[1].replace('_', ' ')} time</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Booked blocks take over from the default loop while they run. Any time you don't book falls back to the default loop.
      </p>

      <div className="space-y-1.5">
        {schedules.length === 0 && (
          <p className="text-xs text-muted-foreground py-3 text-center">No blocks booked — the default loop runs all day.</p>
        )}
        {schedules.map((b) => (
          <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/20">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground truncate">{b.label || 'Block'}</p>
              <p className="text-[10px] text-muted-foreground">
                {b.start_time}–{b.end_time} · {(b.days_of_week || []).length ? b.days_of_week.map((d) => DAYS[d]).join(' ') : 'Every day'} · {nameFor(b.playlist_id)}
              </p>
            </div>
            <button type="button" onClick={() => remove(b.id)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive flex-shrink-0" aria-label="Delete block">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {playlists.length > 0 && (
        <div className="border-t border-border pt-3 space-y-2.5">
          <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="Block name, e.g. Lo-fi mornings" className="rounded-xl h-9 text-sm" />

          <div className="flex flex-wrap gap-1.5">
            {playlists.map((p) => (
              <button key={p.id} type="button" onClick={() => setDraft({ ...draft, playlist_id: p.id })}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                  draft.playlist_id === p.id ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}>
                {p.title}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1">
            {DAYS.map((d, i) => (
              <button key={d} type="button" onClick={() => toggleDay(i)}
                className={`w-9 h-8 rounded-lg text-[11px] font-bold transition-colors ${
                  draft.days.includes(i) ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}>
                {d[0]}
              </button>
            ))}
            <span className="text-[10px] text-muted-foreground self-center ml-1.5">
              {draft.days.length ? '' : 'none selected = every day'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Input type="time" value={draft.start_time} onChange={(e) => setDraft({ ...draft, start_time: e.target.value })}
              className="rounded-xl h-9 text-sm" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="time" value={draft.end_time} onChange={(e) => setDraft({ ...draft, end_time: e.target.value })}
              className="rounded-xl h-9 text-sm" />
          </div>

          <Button size="sm" onClick={add} disabled={busy || !draft.playlist_id}
            className="w-full rounded-xl h-9 text-xs font-bold gap-1.5">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Book this block
          </Button>
        </div>
      )}
    </div>
  );
}