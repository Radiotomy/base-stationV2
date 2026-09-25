import { Sparkles } from 'lucide-react';
import LiveChatPanel from '@/components/live/LiveChatPanel';
import { COOP_HELP, venueChatId } from '@/lib/venue/coopCommands';

/** Venue chat — also the channel audience co-op /generate commands travel on. */
export default function VenueCoopChat({ venueId, user }) {
  return (
    <div className="space-y-2">
      <div className="h-[420px]">
        <LiveChatPanel sessionId={venueChatId(venueId)} currentUser={user} isLive />
      </div>
      <p className="text-xs text-muted-foreground flex gap-1.5">
        <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>Co-create with the host: {COOP_HELP}. Works when the host has audience co-op switched on.</span>
      </p>
    </div>
  );
}