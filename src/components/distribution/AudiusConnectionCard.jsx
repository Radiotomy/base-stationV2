import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link2, Unlink, CheckCircle2, Loader2, Headphones, AlertTriangle, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Audius account connection. Authorization runs through Audius' own OAuth consent
 * screen, so the creator never hands us a password and the resulting tokens live
 * server-side only — this component only ever sees a connection status.
 */
export default function AudiusConnectionCard({ audiusProfile, onConnected, onDisconnected }) {
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    base44.functions
      .invoke('audiusConnection', { action: 'status' })
      .then((res) => setConnection(res.data?.data || null))
      .catch(() => setConnection(null))
      .finally(() => setLoading(false));
  }, []);

  const connect = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('audiusOAuthStart', { scope: 'write' });
      const url = res.data?.data?.authorize_url;
      if (!url) throw new Error('Could not start Audius authorization');
      // Full-page handoff to Audius' consent screen; it returns to /audius-callback.
      window.location.href = url;
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Could not start Audius authorization');
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('audiusConnection', { action: 'disconnect' });
      setConnection(res.data?.data || null);
      const me = await base44.auth.me();
      await base44.auth.updateMe({ metadata: { ...(me.metadata || {}), audius: null } });
      onDisconnected?.();
      toast.success('Audius account disconnected');
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Could not disconnect');
    } finally {
      setBusy(false);
    }
  };

  const connected = !!connection?.connected;
  // Profile snapshot (followers, track counts) comes from the identity sync; the
  // grant itself carries only identity, so the two are shown together.
  const avatar = connection?.profile_picture_url || audiusProfile?.profile_picture;
  const displayName = connection?.name || audiusProfile?.name || connection?.handle;
  const handle = connection?.handle || audiusProfile?.handle;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Headphones className="w-4 h-4 text-emerald-400" />
        <h3 className="font-mono text-xs uppercase tracking-wider text-foreground">Audius Account</h3>
        {loading ? (
          <Badge className="bg-white/10 text-white/50 border-0 ml-auto">Checking…</Badge>
        ) : connected ? (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-0 gap-1 ml-auto">
            <CheckCircle2 className="w-3 h-3" /> Connected
          </Badge>
        ) : (
          <Badge className="bg-white/10 text-white/50 border-0 ml-auto">Not Connected</Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking your Audius connection…
        </div>
      ) : connected ? (
        <div className="flex items-center gap-3">
          {avatar ? (
            <img src={avatar} alt="" className="w-11 h-11 rounded-full object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Headphones className="w-5 h-5 text-emerald-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
              {displayName}
              {connection.verified && <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              @{handle}
              {audiusProfile?.follower_count != null && ` · ${audiusProfile.follower_count} followers`}
              {connection.scope === 'write' ? ' · publishing enabled' : ' · read-only access'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={disconnect} disabled={busy} className="rounded-lg gap-1.5">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />} Disconnect
          </Button>
        </div>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-3">
            Authorize Audius to publish tracks straight to your own artist account. You'll approve
            access on Audius — we never see your password.
          </p>
          {connection?.error_message && (
            <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 rounded-lg p-2.5 mb-3">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{connection.error_message}</span>
            </div>
          )}
          <Button
            onClick={connect}
            disabled={busy}
            className="rounded-lg gap-1.5 bg-emerald-600 hover:bg-emerald-500"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            Connect Audius Account
          </Button>
        </div>
      )}
    </div>
  );
}