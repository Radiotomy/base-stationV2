/**
 * Embeds The Portal 3D stage as a full iframe.
 * The Portal room is created server-side via the createPortalRoom function.
 */
export default function PortalStageViewer({ roomId }) {
  // Phase 5.5 — explicit fallback when Portals is not configured
  if (!roomId) {
    return (
      <div className="relative w-full h-full rounded-2xl border border-dashed border-border flex items-center justify-center bg-muted/20">
        <p className="text-xs text-muted-foreground">3D stage unavailable</p>
      </div>
    );
  }

  const portalUrl = `https://theportal.to/?room=${roomId}`;

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-border">
      <iframe
        src={portalUrl}
        className="w-full h-full border-0"
        allow="fullscreen; microphone; camera"
        title="Live Stage"
      />
      <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs text-white/70 font-semibold pointer-events-none">
        3D Stage • theportal.to
      </div>
    </div>
  );
}