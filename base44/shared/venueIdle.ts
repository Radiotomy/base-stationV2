// Venue idle programming — the shared clock every surface reads.
//
// The whole feature rests on one decision: there is NO server-side playhead.
// A programme's position is DERIVED from (now - cycle_started_at) modulo the
// programme's total length. That keeps the 3D stage, the in-world welcome panel
// and the public venue page in agreement without any of them writing state, and
// it means a fan arriving mid-track lands at the same second as everyone already
// in the room. A stored playhead would drift the moment any one surface missed a
// tick — and there is no way to make three independent clients advance it safely.

/** Fallback length for an entry whose source asset never reported a duration.
 *  Skipping such an entry would silently drop content the artist programmed, so
 *  it gets a plausible slot instead. */
export const FALLBACK_ITEM_SECONDS = 180;

export function itemDuration(item: any): number {
  const d = Number(item?.duration_seconds);
  return Number.isFinite(d) && d > 1 ? d : FALLBACK_ITEM_SECONDS;
}

export function playableItems(playlist: any): any[] {
  return (playlist?.items || []).filter((i: any) => i && i.file_url);
}

export function totalSeconds(playlist: any): number {
  return playableItems(playlist).reduce((sum, i) => sum + itemDuration(i), 0);
}

/** Minutes since local midnight for `HH:MM`, or null when unparseable. */
function minutesOfDay(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Read the wall clock in an IANA zone. Intl is used rather than an offset table
 * because DST shifts would otherwise move an artist's "9am" block twice a year.
 */
function localNow(now: Date, timezone: string): { day: number; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
  } catch {
    // An unknown zone must not take the venue off the air — fall back to UTC.
    return { day: now.getUTCDay(), minutes: now.getUTCHours() * 60 + now.getUTCMinutes() };
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  return {
    day: dayIndex >= 0 ? dayIndex : now.getUTCDay(),
    minutes: (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0),
  };
}

/** Is this block on air right now? Handles blocks that cross midnight. */
export function scheduleIsActive(block: any, now: Date = new Date()): boolean {
  if (!block || block.is_active === false) return false;
  const start = minutesOfDay(block.start_time);
  const end = minutesOfDay(block.end_time);
  if (start === null || end === null || start === end) return false;

  const { day, minutes } = localNow(now, block.timezone || 'America/Chicago');
  const days: number[] = Array.isArray(block.days_of_week) ? block.days_of_week : [];
  const runsToday = days.length === 0 || days.includes(day);

  if (end > start) return runsToday && minutes >= start && minutes < end;

  // Overnight block: after the start it belongs to today's booking, before the
  // end it belongs to YESTERDAY's booking — so the day test shifts back one.
  if (minutes >= start) return runsToday;
  const yesterday = (day + 6) % 7;
  return days.length === 0 || days.includes(yesterday) ? minutes < end : false;
}

/**
 * Pick the programme that should be on air: an active scheduled block wins,
 * otherwise the venue's default loop. Returns the reason so a creator can see
 * WHY a given programme is playing instead of guessing at their own schedule.
 */
export function resolveActivePlaylist(
  playlists: any[],
  schedules: any[],
  now: Date = new Date(),
): { playlist: any | null; source: 'schedule' | 'default' | 'none'; block: any | null } {
  const byId = new Map((playlists || []).map((p) => [p.id, p]));

  const active = (schedules || [])
    .filter((b) => scheduleIsActive(b, now))
    .find((b) => {
      const p = byId.get(b.playlist_id);
      return p && playableItems(p).length > 0;
    });
  if (active) return { playlist: byId.get(active.playlist_id), source: 'schedule', block: active };

  const defaults = (playlists || [])
    .filter((p) => p.is_default_loop && playableItems(p).length > 0)
    .sort((a, b) => String(b.updated_date || '').localeCompare(String(a.updated_date || '')));
  if (defaults[0]) return { playlist: defaults[0], source: 'default', block: null };

  return { playlist: null, source: 'none', block: null };
}

/**
 * Where the programme is right now, and what follows.
 * `offset_seconds` is how far into the current entry playback should already be,
 * which is what a late-joining player seeks to.
 */
export function computeNowPlaying(playlist: any, now: Date = new Date()) {
  const items = playableItems(playlist);
  const total = totalSeconds(playlist);
  if (!items.length || total <= 0) return null;

  const epoch = Date.parse(playlist.cycle_started_at || playlist.created_date || '') || now.getTime();
  const elapsed = (now.getTime() - epoch) / 1000;
  // JS % keeps the sign of the dividend, so a cycle_started_at set in the future
  // would otherwise produce a negative position and select nothing.
  const position = ((elapsed % total) + total) % total;

  let cursor = 0;
  for (let i = 0; i < items.length; i++) {
    const dur = itemDuration(items[i]);
    if (position < cursor + dur) {
      const upNext = [1, 2, 3].map((n) => items[(i + n) % items.length]);
      return {
        playlist_id: playlist.id,
        playlist_title: playlist.title,
        index: i,
        item: items[i],
        offset_seconds: Math.max(0, Math.round(position - cursor)),
        duration_seconds: Math.round(dur),
        seconds_remaining: Math.max(0, Math.round(cursor + dur - position)),
        total_items: items.length,
        up_next: items.length > 1 ? upNext.slice(0, Math.min(3, items.length - 1)) : [],
      };
    }
    cursor += dur;
  }
  return null;
}