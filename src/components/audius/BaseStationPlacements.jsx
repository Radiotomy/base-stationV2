import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Trophy, ListMusic } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/** Back-links from an Audius release to where it sits on BASE Station. */
export default function BaseStationPlacements({ audiusTrackId }) {
  const { data } = useQuery({
    queryKey: ['basePlacements', audiusTrackId],
    enabled: !!audiusTrackId,
    queryFn: async () => {
      const [charts, rows] = await Promise.all([
        base44.entities.TrackChart.filter({ audius_track_id: audiusTrackId }),
        base44.entities.PlaylistTrack.filter({ audius_track_id: audiusTrackId }),
      ]);
      const ids = [...new Set(rows.map((r) => r.playlist_id))];
      const playlists = ids.length ? await base44.entities.Playlist.filter({ id: { $in: ids } }) : [];
      return { charts, playlists };
    },
  });
  if (!data || (!data.charts.length && !data.playlists.length)) return null;

  const chip = 'inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground';
  return (
    <div className="bg-card rounded-2xl border border-border p-4 mb-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">On BASE Station</p>
      <div className="flex flex-wrap gap-2">
        {data.charts.map((c) => (
          <Link key={c.id} to="/charts" className={chip}>
            <Trophy className="w-3.5 h-3.5" />
            {c.chart_rank ? `#${c.chart_rank} · ` : ''}{c.period || 'weekly'} chart{c.genre && c.genre !== 'all' ? ` · ${c.genre}` : ''}
          </Link>
        ))}
        {data.playlists.map((p) => (
          <Link key={p.id} to={`/playlists/${p.id}`} className={chip}>
            <ListMusic className="w-3.5 h-3.5" /> {p.title}
          </Link>
        ))}
      </div>
    </div>
  );
}