import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Headphones, CheckCircle2, Users } from 'lucide-react';
import AudiusTrackCard from '@/components/audius/AudiusTrackCard';
import AudiusTipButton from '@/components/tipping/AudiusTipButton';

export default function AudiusArtist() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    base44.functions.invoke('getAudiusArtist', { userId: id })
      .then(r => setData(r.data?.data || r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  if (!data?.profile) return (
    <div className="min-h-screen flex items-center justify-center text-center">
      <div>
        <Headphones className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">Artist not found on Audius.</p>
        <Link to="/audius-trending" className="text-emerald-400 text-sm mt-3 block">← Trending</Link>
      </div>
    </div>
  );

  const profile = data.profile;
  const tracks = data.tracks || [];
  const cover = profile.cover_photo?.['2000x'] || profile.cover_photo?.['640x'];
  const avatar = profile.profile_picture?.['480x480'] || profile.profile_picture?.['150x150'];

  return (
    <div className="min-h-screen bg-background">
      {/* Cover */}
      <div className="relative h-48 md:h-64 bg-gradient-to-br from-emerald-900 to-teal-950 overflow-hidden">
        {cover && <img src={cover} alt="" className="w-full h-full object-cover opacity-60" />}
        <Link to="/audius-trending" className="absolute top-4 left-4 flex items-center gap-2 text-white/80 hover:text-white bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-lg">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 -mt-16 relative">
        <div className="flex items-end gap-4 mb-6">
          {avatar ? (
            <img src={avatar} alt={profile.handle} className="w-24 h-24 md:w-32 md:h-32 rounded-2xl border-4 border-background object-cover shadow-2xl" />
          ) : (
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl border-4 border-background bg-emerald-500/30 flex items-center justify-center">
              <Headphones className="w-10 h-10 text-emerald-300" />
            </div>
          )}
          <div className="pb-2 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-black text-foreground truncate">{profile.name || profile.handle}</h1>
              {profile.is_verified && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            </div>
            <p className="text-muted-foreground text-sm">@{profile.handle}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{(profile.follower_count || 0).toLocaleString()} followers</span>
              <span>{tracks.length} tracks</span>
            </div>
          </div>
          <div className="pb-2"><AudiusTipButton audiusUserId={profile.id} artistName={profile.name || profile.handle} /></div>
        </div>

        {profile.bio && <p className="text-sm text-muted-foreground mb-6 max-w-2xl">{profile.bio}</p>}

        <h2 className="text-lg font-black text-foreground mb-4">Tracks</h2>
        {tracks.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tracks yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-10">
            {tracks.map(t => <AudiusTrackCard key={t.id} track={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}