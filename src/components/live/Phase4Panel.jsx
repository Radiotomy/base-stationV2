import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Mic, Box, Bot, Sparkles, UserPlus, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useStreamrAudio } from '@/hooks/useStreamrAudio';

const SCENES = [
  { id: 'club', label: '🪩 Club' },
  { id: 'arena', label: '🏟 Arena' },
  { id: 'studio', label: '🎙 Studio' },
  { id: 'void', label: '🌌 Void' },
];
const VIS_STYLES = ['spectrum', 'particles', 'liquid', 'cinematic', 'retro', 'waveform'];

/**
 * Phase 4 — Real-Time Performance Expansion Panel.
 * Drops into LiveStudio without touching any existing logic.
 */
export default function Phase4Panel({ sessionId, isLive, audioMode, onAudioModeChange }) {
  const [session, setSession] = useState(null);
  const [coPerformerId, setCoPerformerId] = useState('');
  const [inviting, setInviting] = useState(false);
  const streamr = useStreamrAudio(sessionId, 'publish');
  const streamrUnavailable = streamr.status === 'unavailable';
  // Phase 5.6 — derive checked from session.audio_mode (or local prop fallback)
  const sessionAudioMode = session?.audio_mode || session?.state?.audio_mode || audioMode || 'sync';

  useEffect(() => {
    if (!sessionId) return;
    base44.entities.LiveSession.filter({ id: sessionId }).then(arr => setSession(arr[0])).catch(() => {});
    const unsub = base44.entities.LiveSession.subscribe(evt => {
      if (evt.data?.id === sessionId) setSession(evt.data);
    });
    return unsub;
  }, [sessionId]);

  const patch = async (patch) => {
    if (!sessionId) return;
    await base44.entities.LiveSession.update(sessionId, patch);
  };

  const toggleStreamr = async (on) => {
    // Phase 5.6 — mirror to audio_mode + state.audio_mode and notify parent (LiveStudio setup radio)
    const newMode = on ? 'streamr' : 'sync';
    await patch({
      streamr_enabled: !!on,
      audio_mode: newMode,
      state: { ...(session?.state || {}), audio_mode: newMode },
    });
    onAudioModeChange?.(newMode);
    if (on) await streamr.startPublish(); else streamr.stopPublish();
  };

  const togglePortals = async (on) => {
    await patch({ portals_enabled: !!on });
    if (on && !session?.portals_room_id && !session?.portal_room_id) {
      try {
        const r = await base44.functions.invoke('createPortalRoom', {
          sessionId, title: session?.title || 'Live', coverImageUrl: '',
        });
        const rid = r?.data?.data?.roomId || r?.data?.roomId;
        if (rid) await patch({ portals_room_id: rid });
      } catch { toast.error('Could not create 3D venue'); }
    }
  };

  const inviteCoPerformer = async () => {
    if (!coPerformerId.trim()) return;
    setInviting(true);
    try {
      const r = await base44.functions.invoke('addCoPerformer', {
        sessionId, userId: coPerformerId.trim(),
      });
      const url = r?.data?.data?.inviteUrl || r?.data?.inviteUrl;
      if (url) {
        const full = `${window.location.origin}${url}`;
        await navigator.clipboard.writeText(full);
        toast.success('Invite link copied!', { icon: <Copy className="w-4 h-4" /> });
      }
      setCoPerformerId('');
    } catch { toast.error('Invite failed'); }
    finally { setInviting(false); }
  };

  if (!sessionId) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <h3 className="font-black text-foreground text-sm flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-400" />
        Phase 4 — Real-Time Expansion
      </h3>

      {/* Phase 5.6 — Streamr Live Audio toggle (mirrors audio_mode) */}
      <div
        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40"
        title={streamrUnavailable ? 'Streamr secrets not configured — enable on the server first' : undefined}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Mic className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">Enable Streamr Live Audio</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {streamrUnavailable
                ? 'Streamr not configured'
                : sessionAudioMode === 'streamr' ? 'Audio mode: streamr' : 'Audio mode: sync'}
            </p>
          </div>
        </div>
        <Switch
          checked={sessionAudioMode === 'streamr'}
          onCheckedChange={toggleStreamr}
          disabled={streamrUnavailable}
        />
      </div>

      {/* Portals 3D venue */}
      <div className="space-y-2 p-3 rounded-xl bg-muted/40">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-indigo-400" />
            <p className="text-xs font-bold text-foreground">3D Venue (Portals)</p>
          </div>
          <Switch checked={!!session?.portals_enabled} onCheckedChange={togglePortals} />
        </div>
        {session?.portals_enabled && (
          <Select value={session?.portals_scene || 'club'} onValueChange={(v) => patch({ portals_scene: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SCENES.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* AI Co-Host */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-emerald-400" />
          <p className="text-xs font-bold text-foreground">AI Co-Host</p>
        </div>
        <Switch
          checked={!!session?.ai_cohost_enabled}
          onCheckedChange={(v) => patch({ ai_cohost_enabled: !!v })}
        />
      </div>

      {/* Visualizer */}
      <div className="space-y-2 p-3 rounded-xl bg-muted/40">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-foreground">Live Visualizer</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Audio Reactive</span>
            <Switch
              checked={!!session?.audio_reactive_visuals}
              onCheckedChange={(v) => patch({ audio_reactive_visuals: !!v })}
            />
          </div>
        </div>
        <Select
          value={session?.active_visualizer_preset_id || 'spectrum'}
          onValueChange={(v) => patch({ active_visualizer_preset_id: v })}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {VIS_STYLES.map(s => <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Co-Performer invite */}
      <div className="space-y-2 p-3 rounded-xl bg-muted/40">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-pink-400" />
          <p className="text-xs font-bold text-foreground">Invite Co-Performer</p>
        </div>
        <div className="flex gap-2">
          <Input
            value={coPerformerId}
            onChange={(e) => setCoPerformerId(e.target.value)}
            placeholder="User ID"
            className="h-8 text-xs"
          />
          <Button size="sm" onClick={inviteCoPerformer} disabled={inviting || !coPerformerId.trim()}
            className="h-8 rounded-lg text-xs gap-1">
            {inviting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
            Invite
          </Button>
        </div>
      </div>
    </div>
  );
}