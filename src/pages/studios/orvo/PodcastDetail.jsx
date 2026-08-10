import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Mic, Upload, Globe, Play } from 'lucide-react';
import CollaboratorPanel from '@/components/studios/orvo/collab/CollaboratorPanel';

function fmtDur(s) {
  if (!s) return '';
  const m = Math.floor(s / 60);
  return `${m} min`;
}

export default function PodcastDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [podcast, setPodcast] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [pods, eps] = await Promise.allSettled([
      base44.entities.Podcast.filter({ id }),
      base44.entities.Episode.filter({ podcast_id: id }, '-created_date', 100),
    ]);
    if (pods.status === 'fulfilled') setPodcast(pods.value?.[0] || null);
    if (eps.status === 'fulfilled') setEpisodes(eps.value || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOwner = user && podcast && podcast.user_id === user.id;

  const publishEpisode = async (ep) => {
    await base44.entities.Episode.update(ep.id, {
      status: 'published',
      published_date: new Date().toISOString(),
    });
    // Publishing is the moment provenance matters — kick off BASE Mark + COS.
    if (!ep.base_mark_asset_id) {
      base44.functions.invoke('registerEpisodeProvenance', { episode_id: ep.id }).catch(() => {});
    }
    toast({ title: 'Episode published 🎙️', description: 'BASE Mark registration started.' });
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#14100C' }}>
        <div className="w-8 h-8 border-4 border-[#FF9A4D]/30 border-t-[#FF9A4D] rounded-full animate-spin" />
      </div>
    );
  }

  if (!podcast) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#14100C' }}>
        <div className="text-center">
          <p className="text-white/60 mb-4">Podcast not found.</p>
          <Link to="/studios/orvo" className="merc-button rounded-full px-6 py-2 text-sm font-black">Back to ORVO</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: '#14100C' }}>
      <div className="max-w-4xl mx-auto px-6 pt-14">
        <Link to="/studios/orvo" className="text-sm text-white/50 hover:text-[#FF9A4D] flex items-center gap-1 mb-6">
          <ArrowLeft className="w-4 h-4" /> ORVO Studio
        </Link>

        {/* Show header */}
        <div className="merc-card rounded-2xl p-6 flex flex-col sm:flex-row gap-6 mb-8">
          <div className="w-36 h-36 rounded-xl overflow-hidden bg-black/40 flex-shrink-0">
            {podcast.cover_image ? (
              <img src={podcast.cover_image} alt={podcast.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Mic className="w-10 h-10 text-white/15" /></div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#FF9A4D]/10 text-[#FF9A4D] border border-[#FF9A4D]/30 capitalize">
              {(podcast.category || 'other').replace('_', ' ')}
            </span>
            <h1 className="font-display text-3xl text-white mt-2 mb-1">{podcast.title}</h1>
            {podcast.user_name && <p className="text-sm text-white/50 mb-2">by {podcast.user_name}</p>}
            {podcast.description && <p className="text-sm text-white/60 mb-3">{podcast.description}</p>}
            <div className="flex flex-wrap items-center gap-3">
              {podcast.website_url && (
                <a href={podcast.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-white/50 hover:text-[#FF9A4D] flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" /> Website
                </a>
              )}
              {podcast.twitter_handle && (
                <a href={`https://x.com/${podcast.twitter_handle}`} target="_blank" rel="noopener noreferrer" className="text-xs text-white/50 hover:text-[#FF9A4D]">
                  @{podcast.twitter_handle}
                </a>
              )}
              {isOwner && (
                <Link to={`/studios/orvo/upload?podcast=${podcast.id}`} className="merc-button rounded-full px-4 py-1.5 text-xs font-black flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Upload Episode
                </Link>
              )}
            </div>
          </div>
        </div>

        {isOwner && <CollaboratorPanel podcastId={podcast.id} />}

        {/* Episodes */}
        <h2 className="font-display text-xl text-white mb-4">Episodes</h2>
        {episodes.length === 0 ? (
          <p className="text-white/40 text-sm">No episodes yet.</p>
        ) : (
          <div className="space-y-3">
            {episodes.map((ep) => (
              <div key={ep.id} className="merc-card merc-card-hover rounded-xl p-4 flex items-center gap-4 transition-all">
                <Link to={`/studios/orvo/episode/${ep.id}`} className="w-11 h-11 rounded-full merc-button flex items-center justify-center flex-shrink-0">
                  <Play className="w-4 h-4 ml-0.5" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/studios/orvo/episode/${ep.id}`} className="font-bold text-sm text-white hover:text-[#FF9A4D] truncate block">
                    {ep.episode_number ? `E${ep.episode_number} · ` : ''}{ep.title}
                  </Link>
                  <p className="text-xs text-white/50 truncate">
                    {fmtDur(ep.duration_seconds)}{ep.is_premium ? ' · Premium' : ''}
                  </p>
                </div>
                {ep.status === 'draft' && (
                  <>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/10 text-white/50">Draft</span>
                    {isOwner && (
                      <button onClick={() => publishEpisode(ep)} className="merc-button rounded-full px-3.5 py-1.5 text-xs font-black">
                        Publish
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}