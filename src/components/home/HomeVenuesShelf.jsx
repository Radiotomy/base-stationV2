import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Box, Radio } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * Home shelf for public 3D venues — live rooms first, then always-on channels.
 * Renders nothing when no creator has published a venue, so the rack never shows
 * an empty slot.
 */
export default function HomeVenuesShelf() {
  const [venues, setVenues] = useState([]);

  useEffect(() => {
    let alive = true;
    base44.functions
      .invoke('listPublicVenues', {})
      .then((res) => { if (alive) setVenues((res.data?.venues || []).slice(0, 3)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (venues.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-black bg-gradient-to-b from-[#1C1712] to-[#0F0C09] p-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-white text-xl md:text-2xl">Venues & Rooms</h2>
        <Link
          to="/venues"
          className="text-[10px] font-black rounded-full px-3.5 py-1.5 flex items-center gap-1 text-[#2A1508]"
          style={{
            background: 'linear-gradient(135deg, #FFB347 0%, #FF7A2F 100%)',
            boxShadow: '0 3px 10px -2px rgba(120,60,10,0.5)',
          }}
        >
          All Venues <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {venues.map((v) => (
          <Link
            key={v.id}
            to={`/venue/${v.id}`}
            className="group rounded-lg border border-black/70 overflow-hidden bg-[#171310] transition-all hover:brightness-110"
          >
            <div className="aspect-video bg-black/40 relative overflow-hidden">
              {(v.now_playing?.thumbnail_url || v.cover_image_url) ? (
                <img
                  src={v.now_playing?.thumbnail_url || v.cover_image_url}
                  alt={v.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Box className="w-7 h-7 text-white/20" />
                </div>
              )}
              {v.is_live && (
                <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-black text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A1F] animate-pulse" /> LIVE
                </span>
              )}
            </div>
            <div className="p-3">
              <p className="font-black text-sm truncate text-white">{v.name}</p>
              <p className="text-[11px] text-white/60 truncate flex items-center gap-1">
                {v.is_live
                  ? <><Radio className="w-3 h-3 flex-shrink-0" /> {v.live_title || 'Live now'}</>
                  : (v.now_playing?.title || 'Room open')}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}