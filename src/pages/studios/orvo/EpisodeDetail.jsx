import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ArrowLeft, Mic } from 'lucide-react';
import OrvoAudioPlayer from '@/components/studios/orvo/player/OrvoAudioPlayer';
import EpisodeIntelligencePanel from '@/components/studios/orvo/studio/EpisodeIntelligencePanel';
import EpisodeProvenancePanel from '@/components/studios/orvo/provenance/EpisodeProvenancePanel';

export default function EpisodeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [episode, setEpisode] = useState(null);
  const [podcast, setPodcast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const eps = await base44.entities.Episode.filter({ id });
      const ep = eps?.[0] || null;
      if (!alive) return;
      setEpisode(ep);
      if (ep?.podcast_id) {
        const pods = await base44.entities.Podcast.filter({ id: ep.podcast_id });
        if (alive) setPodcast(pods?.[0] || null);
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [id]);

  const firePlayAnalytics = () => {
    if (!episode) return;
    base44.entities.OrvoAnalytics.create({
      event_type: 'play',
      episode_id: episode.id,
      podcast_id: episode.podcast_id,
      listener_id: user?.id,
      creator_id: episode.user_id,
    }).catch(() => {});
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#14100C' }}>
        <div className="w-8 h-8 border-4 border-[#FF9A4D]/30 border-t-[#FF9A4D] rounded-full animate-spin" />
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#14100C' }}>
        <div className="text-center">
          <p className="text-white/60 mb-4">Episode not found.</p>
          <Link to="/studios/orvo" className="merc-button rounded-full px-6 py-2 text-sm font-black">Back to ORVO</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: '#14100C' }}>
      <div className="max-w-3xl mx-auto px-6 pt-14">
        <Link
          to={podcast ? `/studios/orvo/podcast/${podcast.id}` : '/studios/orvo'}
          className="text-sm text-white/50 hover:text-[#FF9A4D] flex items-center gap-1 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> {podcast?.title || 'ORVO Studio'}
        </Link>

        <div className="flex items-start gap-5 mb-6">
          <div className="w-28 h-28 rounded-xl overflow-hidden bg-black/40 flex-shrink-0">
            {(episode.thumbnail_url || podcast?.cover_image) ? (
              <img src={episode.thumbnail_url || podcast.cover_image} alt={episode.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Mic className="w-8 h-8 text-white/15" /></div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {episode.status === 'draft' && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/10 text-white/50">Draft</span>
              )}
              {episode.is_premium && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#FF9A4D]/15 text-[#FF9A4D] border border-[#FF9A4D]/30">Premium</span>
              )}
            </div>
            <h1 className="font-display text-2xl md:text-3xl text-white mt-1.5">
              {episode.episode_number ? `E${episode.episode_number} · ` : ''}{episode.title}
            </h1>
            {podcast && (
              <Link to={`/studios/orvo/podcast/${podcast.id}`} className="text-sm text-[#FF9A4D] hover:underline">
                {podcast.title}
              </Link>
            )}
          </div>
        </div>

        <OrvoAudioPlayer
          src={episode.audio_url}
          chapters={episode.chapters || []}
          onFirstPlay={firePlayAnalytics}
        />

        {episode.description && (
          <div className="merc-card rounded-2xl p-5 mt-6">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">About this episode</p>
            <p className="text-sm text-white/70 whitespace-pre-wrap">{episode.description}</p>
          </div>
        )}

        {user?.id === episode.user_id && (
          <>
            <EpisodeProvenancePanel episode={episode} onUpdate={setEpisode} />
            <EpisodeIntelligencePanel episode={episode} />
          </>
        )}
      </div>
    </div>
  );
}