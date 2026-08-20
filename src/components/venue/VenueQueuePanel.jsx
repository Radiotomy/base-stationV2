import { Music, Film, ListMusic } from 'lucide-react';

/**
 * "Coming up" for a venue's idle programme. Shown only when the artist listed
 * the channel publicly — a private programme still plays, it just doesn't reveal
 * the whole run of show.
 */
export default function VenueQueuePanel({ channel, nowPlaying }) {
  const upNext = channel?.listed ? (nowPlaying?.up_next || []) : [];

  return (
    <div className="merc-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ListMusic className="w-4 h-4 text-accent" />
        <p className="font-bold text-foreground text-sm">
          {channel?.title || 'Venue channel'}
        </p>
      </div>

      {!channel && (
        <p className="text-sm text-muted-foreground">This venue has no programme on air right now.</p>
      )}

      {channel && !channel.listed && (
        <p className="text-sm text-muted-foreground">The artist keeps this channel's line-up private.</p>
      )}

      {upNext.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Coming up</p>
          {upNext.map((item, i) => {
            const Icon = item.media_kind === 'video' ? Film : Music;
            return (
              <div key={`${item.asset_id}-${i}`} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                  {item.thumbnail_url
                    ? <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    : <Icon className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{item.media_kind}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {channel && channel.listed && upNext.length === 0 && (
        <p className="text-sm text-muted-foreground">This channel is a single item on repeat.</p>
      )}
    </div>
  );
}