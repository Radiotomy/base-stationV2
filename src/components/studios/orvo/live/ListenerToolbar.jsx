import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Share2, Clock, Bell, Check } from 'lucide-react';

const btn = 'merc-button-dark rounded-full px-4 py-2 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50';

/** Audience tools for a live session: share, follow the show, save for later. */
export default function ListenerToolbar({ event, user }) {
  const { toast } = useToast();
  const [following, setFollowing] = useState(false);
  const [queued, setQueued] = useState(false);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: event.title, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const follow = async () => {
    if (!user) return;
    try {
      await base44.entities.OrvoFollow.create({ follower_id: user.id, podcast_id: event.podcast_id });
      setFollowing(true);
    } catch (e) {
      toast({ title: 'Could not follow', description: e.message, variant: 'destructive' });
    }
  };

  const saveForLater = async () => {
    if (!user || !event.archived_episode_id) return;
    try {
      await base44.entities.OrvoListenLater.create({
        user_id: user.id,
        episode_id: event.archived_episode_id,
        podcast_id: event.podcast_id,
      });
      setQueued(true);
    } catch (e) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={share} className={btn}>
        {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />} {copied ? 'Link copied' : 'Share'}
      </button>
      {user && (
        <button onClick={follow} disabled={following} className={btn}>
          <Bell className="w-3.5 h-3.5" /> {following ? 'Following show' : 'Follow show'}
        </button>
      )}
      {user && event.archived_episode_id && (
        <button onClick={saveForLater} disabled={queued} className={btn}>
          <Clock className="w-3.5 h-3.5" /> {queued ? 'Saved' : 'Listen later'}
        </button>
      )}
    </div>
  );
}