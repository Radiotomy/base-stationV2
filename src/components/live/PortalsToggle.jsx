import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Performer-side toggle for the Portals 3D stage.
 * Default OFF. When ON, creates/loads a portal_room_id and sets visual_layer="portals".
 * When OFF, clears portal_room_id and reverts to visual_layer="visualizer".
 *
 * Reliability: if portal creation fails, revert toggle to OFF and toast.
 */
export default function PortalsToggle({ sessionId, title, coverImageUrl, value, onChange }) {
  const [loading, setLoading] = useState(false);
  const enabled = value === 'portals';

  const enablePortals = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('createPortalRoom', {
        sessionId,
        title: title || 'Live Session',
        coverImageUrl: coverImageUrl || '',
      });
      const roomId = res?.data?.roomId;
      if (!roomId) throw new Error(res?.data?.error || 'No room id returned');

      // Update session: visual_layer + analytics flag. portal_room_id is set
      // server-side by createPortalRoom itself.
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
      toast.success('Portals Stage Enabled');
    } catch (err) {
      toast.error('Portals failed to load. Reverting to Visualizer.');
      // Best-effort: ensure session state reflects the revert
      try {
        await base44.entities.LiveSession.update(sessionId, {
          visual_layer: 'visualizer',
          portal_room_id: null,
        });
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
        portal_room_id: null,
      });
      onChange?.('visualizer');
      toast.success('Portals Stage Disabled');
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const handleToggle = (next) => {
    if (!sessionId) {
      toast.error('Create a session first');
      return;
    }
    if (loading) return;
    if (next) enablePortals();
    else disablePortals();
  };

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-muted/30">
      <div className="flex items-start gap-2 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-500/30 to-cyan-500/30 border border-white/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-fuchsia-300" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">Enable Portals Stage</p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Optional immersive 3D stage. Fans can still choose Standard Mode.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        <Switch
          checked={enabled}
          disabled={loading || !sessionId}
          onCheckedChange={handleToggle}
        />
      </div>
    </div>
  );
}