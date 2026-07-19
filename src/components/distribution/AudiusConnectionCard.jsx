import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link2, Unlink, CheckCircle2, Loader2, Headphones } from 'lucide-react';
import { toast } from 'sonner';

export default function AudiusConnectionCard({ audiusProfile, onConnected, onDisconnected }) {
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    if (!handle.trim()) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('audiusClient', {
        action: 'resolveHandle',
        payload: { handle: handle.trim() },
      });
      const audiusUser = res.data?.data;
      if (!audiusUser?.id) throw new Error('No Audius profile found for that handle');
      const sync = await base44.functions.invoke('syncAudiusIdentity', { audiusUserId: audiusUser.id });
      onConnected(sync.data?.data);
      toast.success(`Connected to Audius as @${sync.data?.data?.handle || handle.trim()}`);
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Could not connect Audius account');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      const me = await base44.auth.me();
      await base44.auth.updateMe({ metadata: { ...(me.metadata || {}), audius: null } });
      onDisconnected();
      toast.success('Audius account disconnected');
    } catch {
      toast.error('Could not disconnect');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Headphones className="w-4 h-4 text-emerald-400" />
        <h3 className="font-mono text-xs uppercase tracking-wider text-foreground">Audius Account</h3>
        {audiusProfile ? (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-0 gap-1 ml-auto">
            <CheckCircle2 className="w-3 h-3" /> Connected
          </Badge>
        ) : (
          <Badge className="bg-white/10 text-white/50 border-0 ml-auto">Not Connected</Badge>
        )}
      </div>

      {audiusProfile ? (
        <div className="flex items-center gap-3">
          {audiusProfile.profile_picture ? (
            <img src={audiusProfile.profile_picture} alt="" className="w-11 h-11 rounded-full object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Headphones className="w-5 h-5 text-emerald-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{audiusProfile.name || audiusProfile.handle}</p>
            <p className="text-xs text-muted-foreground truncate">
              @{audiusProfile.handle} · {audiusProfile.follower_count ?? 0} followers · {audiusProfile.track_count ?? 0} tracks
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={disconnect} disabled={busy} className="rounded-lg gap-1.5">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />} Disconnect
          </Button>
        </div>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-3">
            Link your Audius profile to publish tracks directly to the Audius streaming network.
          </p>
          <div className="flex gap-2">
            <Input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@your-audius-handle"
              onKeyDown={(e) => e.key === 'Enter' && connect()}
              className="rounded-lg"
            />
            <Button onClick={connect} disabled={busy || !handle.trim()} className="rounded-lg gap-1.5 bg-emerald-600 hover:bg-emerald-500 flex-shrink-0">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />} Connect Account
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}