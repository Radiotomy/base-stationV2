import { useEffect, useRef } from 'react';
import { Box } from 'lucide-react';

/**
 * Phase 4 — Portals 3D venue stage.
 * Embeds a Portal room as iframe and forwards live event-bus events
 * via postMessage so the venue can react in 3D.
 */
export default function PortalsStage({ roomId, scene = 'club', events = [] }) {
  const iframeRef = useRef(null);
  const lastSentRef = useRef(null);

  useEffect(() => {
    if (!iframeRef.current || !events.length) return;
    const newest = events[events.length - 1];
    if (!newest || newest.id === lastSentRef.current) return;
    lastSentRef.current = newest.id;
    try {
      iframeRef.current.contentWindow?.postMessage(
        { source: 'basestation', type: newest.type, payload: newest.payload },
        '*'
      );
    } catch {}
  }, [events]);

  if (!roomId) {
    return (
      <div className="aspect-video w-full rounded-2xl bg-muted/30 border border-dashed border-border flex flex-col items-center justify-center text-center gap-2">
        <Box className="w-8 h-8 text-muted-foreground opacity-30" />
        <p className="text-xs text-muted-foreground">3D venue not enabled</p>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full rounded-2xl overflow-hidden border border-border bg-black">
      <iframe
        ref={iframeRef}
        src={`https://theportal.to/?room=${roomId}&scene=${scene}`}
        className="w-full h-full"
        allow="microphone; camera; xr-spatial-tracking"
        title="Portals 3D Venue"
      />
    </div>
  );
}