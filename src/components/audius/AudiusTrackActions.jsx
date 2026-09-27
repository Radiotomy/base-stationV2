import { Link } from "react-router-dom";
import { User, Heart, Info } from "lucide-react";
import AudiusTipButton from "@/components/tipping/AudiusTipButton";

const pill = "inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-white/15 text-xs text-white/80 hover:text-white hover:border-white/40 transition-colors";

// Compact artist / like / tip row for any Audius track (radio, playlists, players).
// Renders nothing for non-Audius tracks.
export default function AudiusTrackActions({ track, className = "" }) {
  const trackId = track?.audius_id || track?.audius_track_id;
  const userId = track?.audius_user_id;
  if (!trackId && !userId) return null;
  const likeUrl = track.permalink ? `https://audius.co${track.permalink}` : track.audius_permalink;

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`} onClick={(e) => e.stopPropagation()}>
      {userId ? (
        <Link to={`/audius-artist/${userId}`} className={pill} title={`View ${track.artist_name}`}>
          <User className="w-3.5 h-3.5" /> Artist
        </Link>
      ) : (
        <Link to={`/audius-track/${trackId}`} className={pill} title="Track & artist details">
          <Info className="w-3.5 h-3.5" /> Details
        </Link>
      )}
      {likeUrl && (
        <a href={likeUrl} target="_blank" rel="noopener noreferrer" className={pill} title="Like this track on Audius">
          <Heart className="w-3.5 h-3.5" /> Like
        </a>
      )}
      {userId && <AudiusTipButton compact audiusUserId={userId} artistName={track.artist_name} trackTitle={track.track_title} />}
    </div>
  );
}