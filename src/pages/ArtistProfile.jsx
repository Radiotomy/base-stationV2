import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Music, Users, Play, Pause, Heart, Globe, ExternalLink, Star,
  MessageCircle, ChevronDown, ChevronUp, MapPin, Wrench, Crown, Award, ShoppingBag
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TipModal from "@/components/tipping/TipModal";
import FollowButton from "@/components/follow/FollowButton";
import TrackReactions from "@/components/community/TrackReactions";
import TrackComments from "@/components/community/TrackComments";
import TopFans from "@/components/community/TopFans";
import CollectiblesGrid from "@/components/collectibles/CollectiblesGrid";
import AILabelBadge from "@/components/common/AILabelBadge";
import CreatorPodcastShowcase from "@/components/studios/orvo/CreatorPodcastShowcase";
import CreatorPatchShowcase from "@/components/foundry/CreatorPatchShowcase";

function StatBox({ value, label }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-black text-foreground">{typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function TrackRow({ track, isPlaying, onPlay, currentUser }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-card border border-border overflow-hidden transition-all">
      {/* Main row */}
      <div className="flex items-center gap-4 p-4">
        {/* Play Button / Cover */}
        <div
          className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer group"
          onClick={() => onPlay(track)}
        >
          {track.cover_image_url
            ? <img src={track.cover_image_url} alt={track.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-purple-800 to-indigo-900 flex items-center justify-center"><Music className="w-5 h-5 text-white/30" /></div>
          }
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {isPlaying ? <Pause className="w-4 h-4 text-white" fill="white" /> : <Play className="w-4 h-4 text-white ml-0.5" fill="white" />}
          </div>
          {isPlaying && (
            <div className="absolute inset-0 bg-purple-600/40 flex items-center justify-center">
              <Pause className="w-4 h-4 text-white" fill="white" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate text-foreground">{track.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <AILabelBadge label={track.ai_label} size="xs" />
            {track.genre && <Badge variant="outline" className="text-xs capitalize px-1.5 py-0">{track.genre}</Badge>}
            {track.bpm && <span className="text-xs text-muted-foreground">{track.bpm} BPM</span>}
            {track.key && <span className="text-xs text-muted-foreground">{track.key}</span>}
          </div>
        </div>

        {/* Reactions */}
        <div className="hidden sm:block">
          <TrackReactions trackId={track.id} currentUser={currentUser} />
        </div>

        {/* Stats + expand */}
        <div className="flex items-center gap-3 flex-shrink-0 text-muted-foreground">
          <span className="flex items-center gap-1 text-xs"><Play className="w-3 h-3" />{track.play_count || 0}</span>
          <span className="flex items-center gap-1 text-xs"><Heart className="w-3 h-3" />{track.like_count || 0}</span>
          {track.track_url && (
            <a href={track.track_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-purple-400 hover:text-purple-300">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button onClick={() => setExpanded(p => !p)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile reactions */}
      <div className="sm:hidden px-4 pb-2">
        <TrackReactions trackId={track.id} currentUser={currentUser} />
      </div>

      {/* Expanded: comments */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border">
            <div className="p-4">
              <TrackComments trackId={track.id} trackTitle={track.title} currentUser={currentUser} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ArtistProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [xpData, setXpData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTipModal, setShowTipModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [playingTrack, setPlayingTrack] = useState(null);

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me().catch(() => null);
      setCurrentUser(u);
      const [profiles, submittedTracks] = await Promise.all([
        base44.entities.ArtistProfile.filter({ user_id: id }),
        base44.entities.TrackSubmission.filter({ artist_id: id, status: "approved" }, "-created_date", 20),
      ]);
      setProfile(profiles[0] || null);
      setTracks(submittedTracks);
      const xp = await base44.entities.UserXP.filter({ user_id: id });
      setXpData(xp[0] || null);
      setLoading(false);
    };
    load();
  }, [id]);

  const handlePlay = (track) => {
    if (!track.track_url) return;
    if (playingTrack?.id === track.id) {
      audioRef.current?.paused ? audioRef.current.play() : audioRef.current?.pause();
      setPlayingTrack(audioRef.current?.paused ? null : track);
      return;
    }
    if (audioRef.current) {
      audioRef.current.src = track.track_url;
      audioRef.current.play().catch(() => {});
    }
    setPlayingTrack(track);
  };

  useEffect(() => {
    return () => { if (audioRef.current) audioRef.current.pause(); };
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  if (!profile) {
    if (currentUser && currentUser.id === id) { navigate("/my-profile"); return null; }
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Artist profile not found.</p>
          <Link to="/" className="text-purple-400 text-sm mt-2 block">Go Home</Link>
        </div>
      </div>
    );
  }

  const isOwner = currentUser && currentUser.id === profile.user_id;
  const level = xpData ? Math.min(10, Math.floor(Math.sqrt((xpData.total_xp || 0) / 100)) + 1) : 1;

  return (
    <div className="min-h-screen bg-background">
      <audio ref={audioRef} onEnded={() => setPlayingTrack(null)} />

      {/* Banner */}
      <div className="relative h-56 md:h-72 overflow-hidden">
        {profile.banner_url
          ? <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-purple-900 via-indigo-900 to-pink-900" />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-20 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-6 items-end mb-8">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={profile.display_name} className="w-28 h-28 md:w-36 md:h-36 rounded-2xl object-cover border-4 border-background shadow-2xl" />
              : <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 border-4 border-background shadow-2xl flex items-center justify-center">
                  <span className="text-4xl font-black text-white">{(profile.display_name || "?")[0].toUpperCase()}</span>
                </div>
            }
            {profile.is_verified && (
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-blue-500 border-2 border-background flex items-center justify-center">
                <Star className="w-4 h-4 text-white fill-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 pb-2">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-3xl md:text-4xl font-black text-foreground">{profile.display_name}</h1>
              {profile.genre && <Badge variant="outline" className="capitalize text-xs">{profile.genre}</Badge>}
              {xpData && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Lvl {level}</Badge>}
            </div>
            {profile.bio && <p className="text-muted-foreground text-sm max-w-lg leading-relaxed mb-2">{profile.bio}</p>}
            <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
              {profile.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{profile.location}</span>}
              {profile.ai_tools?.length > 0 && <span className="flex items-center gap-1"><Wrench className="w-3 h-3" />{profile.ai_tools.join(", ")}</span>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 items-center flex-shrink-0 pb-2 flex-wrap">
            {!isOwner && (
              <>
                <FollowButton targetUserId={profile.user_id} targetUserName={profile.display_name} />
                {profile.tipping_enabled && (
                  <Button onClick={() => setShowTipModal(true)} variant="outline" className="rounded-full border-pink-500/40 text-pink-400 hover:bg-pink-500/10 font-semibold">
                    <Heart className="w-4 h-4 mr-1.5" /> Tip
                  </Button>
                )}
                <Link to={`/fanclub/${id}`}>
                  <Button variant="outline" className="rounded-full border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 font-semibold">
                    <Crown className="w-4 h-4 mr-1.5" /> Join Fan Club
                  </Button>
                </Link>
                <Link to={`/creator-store/${id}`}>
                  <Button variant="outline" className="rounded-full border-purple-500/40 text-purple-400 hover:bg-purple-500/10 font-semibold">
                    <ShoppingBag className="w-4 h-4 mr-1.5" /> Store
                  </Button>
                </Link>
              </>
            )}
            {isOwner && (
              <Link to="/my-profile">
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 cursor-pointer hover:bg-purple-500/30 transition-colors">
                  ✏️ Edit Profile
                </Badge>
              </Link>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4 p-6 rounded-2xl bg-card border border-border mb-8">
          <StatBox value={profile.track_count || tracks.length} label="Tracks" />
          <StatBox value={profile.follower_count || 0} label="Followers" />
          <StatBox value={profile.following_count || 0} label="Following" />
          <StatBox value={profile.total_plays || 0} label="Total Plays" />
          {xpData && <StatBox value={(xpData.total_xp || 0).toLocaleString()} label="XP" />}
          {xpData && <StatBox value={xpData.challenges_won || 0} label="Wins" />}
        </div>

        {/* Now Playing Bar */}
        <AnimatePresence>
          {playingTrack && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="sticky top-16 z-20 flex items-center gap-3 p-3 rounded-2xl bg-purple-600/90 backdrop-blur border border-purple-500/50 mb-4 shadow-lg">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse flex-shrink-0" />
              <p className="text-sm font-bold text-white flex-1 truncate">Now Playing: {playingTrack.title}</p>
              <button onClick={() => { audioRef.current?.pause(); setPlayingTrack(null); }}
                className="text-white/70 hover:text-white text-xs">Stop</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collectibles */}
        <div className="mb-8">
          <h2 className="text-xl font-black text-foreground mb-5 flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-400" /> Collectibles
          </h2>
          <CollectiblesGrid creatorId={id} />
        </div>

        {/* Podcasts */}
        <CreatorPodcastShowcase creatorId={id} />

        {/* Foundry patches */}
        <CreatorPatchShowcase creatorId={id} />

        {/* Top Fans */}
        <TopFans artistId={id} />

        {/* Tracks */}
        <div className="mb-12">
          <h2 className="text-xl font-black text-foreground mb-5 flex items-center gap-2">
            <Music className="w-5 h-5 text-purple-400" /> Tracks
            <span className="text-sm font-normal text-muted-foreground ml-1">— click ↓ to comment & react</span>
          </h2>
          {tracks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
              <Music className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No approved tracks yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  isPlaying={playingTrack?.id === track.id}
                  onPlay={handlePlay}
                  currentUser={currentUser}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showTipModal && (
        <TipModal
          artist={{ id: profile.user_id, name: profile.display_name, email: profile.user_email }}
          onClose={() => setShowTipModal(false)}
        />
      )}
    </div>
  );
}