import { Radio, Headphones } from 'lucide-react';

function embedUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname === 'youtu.be') {
      const id = u.hostname === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : null;
    }
    if (u.hostname.includes('twitch.tv')) {
      const channel = u.pathname.replace('/', '');
      return channel ? `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}` : null;
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch { /* not a URL */ }
  return null;
}

/**
 * The audience stage: live video/audio while the event is on air, and the
 * archived recording once it has ended.
 */
export default function LiveStagePlayer({ event }) {
  const isLive = event.status === 'live';
  const source = isLive ? event.stream_url : (event.recording_url || event.stream_url);

  if (!source) {
    return (
      <div className="merc-card rounded-2xl p-10 text-center">
        {event.media_type === 'video' ? <Radio className="w-8 h-8 text-white/20 mx-auto mb-3" /> : <Headphones className="w-8 h-8 text-white/20 mx-auto mb-3" />}
        <p className="text-sm text-white/50">
          {isLive ? 'The host hasn’t connected a stream yet.' : 'No recording has been archived for this session yet.'}
        </p>
      </div>
    );
  }

  const embed = embedUrl(source);

  return (
    <div className="merc-card rounded-2xl overflow-hidden">
      {embed ? (
        <div className="aspect-video bg-black">
          <iframe src={embed} title={event.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen className="w-full h-full border-0" />
        </div>
      ) : event.media_type === 'video' ? (
        <video src={source} controls playsInline className="w-full aspect-video bg-black" />
      ) : (
        <div className="p-5">
          <audio src={source} controls className="w-full" />
        </div>
      )}
      <div className="px-4 py-2.5 flex items-center gap-2 border-t border-white/5">
        <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-white/25'}`} />
        <p className="text-xs text-white/50">
          {isLive ? `Live ${event.media_type} broadcast` : 'Archived session replay'}
        </p>
      </div>
    </div>
  );
}