import { Link } from "react-router-dom";
import { Users, ChevronRight } from "lucide-react";

export default function FollowedArtistsSection({ follows }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-[#FF9A4D]" />
        <h3 className="font-black text-sm">Artists You Follow</h3>
        <span className="text-xs text-muted-foreground ml-auto">{follows.length}</span>
      </div>
      {follows.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-2">You're not following anyone yet.</p>
          <Link to="/featured-artists" className="text-xs font-bold text-[#FFC98A] hover:text-white">
            Discover featured artists →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {follows.map(f => (
            <Link key={f.id} to={`/artist/${f.following_id}`}
              className="flex items-center gap-3 p-2.5 rounded-xl border border-border/60 hover:border-[#FF9A4D]/40 transition-colors group">
              {f.following_avatar_url ? (
                <img src={f.following_avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-[#FF9A4D]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-black text-[#FFC98A]">{(f.following_name || "?")[0].toUpperCase()}</span>
                </div>
              )}
              <p className="text-sm font-bold text-foreground truncate flex-1">{f.following_name || "Artist"}</p>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-[#FFC98A] flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}