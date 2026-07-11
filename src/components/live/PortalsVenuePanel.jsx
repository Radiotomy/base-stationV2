import { useState, useEffect } from 'react';
import { Sparkles, Loader2, ExternalLink, Copy, RefreshCw, Box } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import PortalStageViewer from '@/components/live/PortalStageViewer';
import PortalsVideoWall from '@/components/live/PortalsVideoWall';

/**
 * Full Portals 3D venue control panel for Live Studio performers.
 * - Verifies the Portals access key before offering the toggle
 * - Creates the live venue room (stage + screens) via createPortalRoom
 * - Shows the fan room URL (copy + open), embedded stage preview
 * - "Sync Now Playing" pushes the current track title + cover onto the in-room screens
 */
export default function PortalsVenuePanel({ sessionId, title, currentTrack, value, onChange }) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [configured, setConfigured] = useState(null); // null = checking
  const [roomId, setRoomId] = useState('');
  const enabled = value === 'portals';
  const fanUrl = roomId ? `https://theportal.to/?room=${roomId}` : '';

  // Verify access key once
  useEffect(() => {
    base44.functions.invoke('createPortalRoom', { action: 'verify' })
      .then(r => setConfigured(!!r?.data?.configured))
      .catch(() => setConfigured(false));
  }, []);

  // Restore existing room id from the session
  useEffect(() => {
    if (!sessionId) return;
    base44.entities.LiveSession.filter({ id: sessionId })
      .then(rows => { if (rows[0]?.portal_room_id) { setRoomId(rows[0].portal_room_id); onChange?.(rows[0].visual_layer || 'portals'); } })
      .catch(() => {});
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const enablePortals = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('createPortalRoom', {
        sessionId,
        title: title || 'Live Session',
        coverImageUrl: currentTrack?.thumbnail_url || '',
      });
      const rid = res?.data?.roomId;
      if (!rid) throw new Error(res?.data?.error || 'No room id returned');
      setRoomId(rid);
      await base44.entities.LiveSession.update(sessionId, {
        visual_layer: 'portals',
        visual_layer_analytics: {
          visual_layer_enabled_by_creator: true,
          fan_visual_layer_choices: { standard: 0, portals: 0 },
          portals_load_failures: 0,
          total_time_in_3d_ms: 0,
        },
      });
      onChange?.('portals');
      toast.success('🌐 3D Portals venue is live — fans can now enter the stage');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Portals venue failed to create. Reverting to Visualizer.');
      try {
        await base44.entities.LiveSession.update(sessionId, { visual_layer: 'visualizer', portal_room_id: null });
      } catch { /* silent */ }
      onChange?.('visualizer');
    }
    setLoading(false);
  };

  const disablePortals = async () => {
    setLoading(true);
    try {
      await base44.entities.LiveSession.update(sessionId, {
        visual_layer: 'visualizer',
        portals_enabled: false,
      });
      onChange?.('visualizer');
      toast.success('Portals venue hidden — fans see the Visualizer');
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const syncNowPlaying = async () => {
    if (!currentTrack) { toast.error('Select a track first'); return; }
    setSyncing(true);
    try {
      await base44.functions.invoke('createPortalRoom', {
        action: 'update_now_playing',
        sessionId,
        trackTitle: currentTrack.title || '',
        coverImageUrl: currentTrack.thumbnail_url || '',
      });
      toast.success('Stage screens updated with the current track');
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    }
    setSyncing(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(fanUrl);
    toast.success('Room link copied — share it with fans');
  };

  if (configured === false) {
    return (
      <div className="p-3 rounded-xl border border-dashed border-border bg-muted/20 text-[11px] text-muted-foreground flex items-center gap-2">
        <Box className="w-4 h-4 flex-shrink-0 opacity-50" />
        Portals 3D venue unavailable — access key not configured or invalid.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
      {/* Toggle row */}
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="flex items-start gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-500/30 to-cyan-500/30 border border-white/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-300" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Portals 3D Venue</p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Perform on an immersive 3D stage with spatial voice chat. Fans can still choose Standard Mode.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {(loading || configured === null) && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          <Switch
            checked={enabled}
            disabled={loading || !sessionId || configured === null}
            onCheckedChange={(next) => {
              if (!sessionId) { toast.error('Create a session first'); return; }
              if (loading) return;
              next ? enablePortals() : disablePortals();
            }}
          />
        </div>
      </div>

      {/* Venue controls — visible when enabled with a room */}
      {enabled && roomId && (
        <div className="border-t border-border p-3 space-y-3">
          <div className="h-52">
            <PortalStageViewer roomId={roomId} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={copyLink} className="rounded-lg h-8 gap-1.5 text-xs flex-1">
              <Copy className="w-3.5 h-3.5" /> Copy Room Link
            </Button>
            <Button size="sm" variant="outline" asChild className="rounded-lg h-8 gap-1.5 text-xs flex-1">
              <a href={fanUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" /> Enter Stage
              </a>
            </Button>
          </div>
          <Button size="sm" onClick={syncNowPlaying} disabled={syncing || !currentTrack}
            className="w-full rounded-lg h-8 gap-1.5 text-xs font-bold bg-fuchsia-600 hover:bg-fuchsia-500">
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {syncing ? 'Updating stage…' : 'Sync Now Playing to Stage'}
          </Button>
          <PortalsVideoWall sessionId={sessionId} />
          <p className="text-[10px] text-muted-foreground leading-snug">
            Enter the stage yourself to perform — Portals has built-in voice chat (allow your mic).
            Fans watching in 3D Mode join the same room. "Sync" pushes your current track's title and cover art onto the venue screens.
          </p>
        </div>
      )}
    </div>
  );
}