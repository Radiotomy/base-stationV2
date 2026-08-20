import { useState, useEffect } from 'react';
import { KeyRound, Loader2, ShieldCheck, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Hybrid ownership control. By default venues are provisioned under BASE
 * Station's own Portals account, so a creator needs nothing. A creator who owns
 * a Portals space can connect their key here and have future venues created
 * under their wallet instead. The key itself is write-only — we only ever read
 * back a connection status.
 */
export default function PortalsKeyPanel() {
  const [status, setStatus] = useState(null); // null = loading
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    base44.functions.invoke('verifyPortalAccessKey', { action: 'status' })
      .then((r) => setStatus(r?.data || { connected: false }))
      .catch(() => setStatus({ connected: false }));
  };

  useEffect(load, []);

  const connect = async () => {
    if (!key.trim()) { toast.error('Paste your Portals access key first'); return; }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('verifyPortalAccessKey', {
        action: 'connect',
        accessKey: key.trim(),
        label: label.trim(),
      });
      if (!res?.data?.connected) throw new Error(res?.data?.error || 'Could not verify that key');
      toast.success('Portals account connected — new venues will be owned by your wallet');
      setKey('');
      setLabel('');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    }
    setBusy(false);
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await base44.functions.invoke('verifyPortalAccessKey', { action: 'disconnect' });
      toast.success('Disconnected — existing venues are unchanged');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    }
    setBusy(false);
  };

  if (status === null) {
    return (
      <div className="merc-card rounded-2xl p-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking Portals connection…
      </div>
    );
  }

  return (
    <div className="merc-card rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
            <KeyRound className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Venue Ownership</p>
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
              {status.connected
                ? 'New venues are created under your own Portals account, so your wallet owns them.'
                : 'Venues are hosted on BASE Station’s account — nothing to set up. Own a Portals space? Connect it to own your venues outright.'}
            </p>
          </div>
        </div>
        {status.connected && (
          <Badge className="text-[10px] gap-1 flex-shrink-0">
            <ShieldCheck className="w-3 h-3" /> Connected
          </Badge>
        )}
      </div>

      {status.connected ? (
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground truncate">
            {status.label || 'Your Portals account'}
          </p>
          <Button size="sm" variant="outline" onClick={disconnect} disabled={busy}
            className="rounded-lg h-8 gap-1.5 text-xs flex-shrink-0">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-2 pt-1">
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Portals access key"
            type="password"
            className="h-9 text-sm rounded-lg"
          />
          <div className="flex gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nickname (optional)"
              className="h-9 text-sm rounded-lg"
            />
            <Button size="sm" onClick={connect} disabled={busy}
              className="rounded-lg h-9 text-xs font-bold flex-shrink-0">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Your key is stored securely and never shown again. Disconnecting only affects future venues.
          </p>
        </div>
      )}
    </div>
  );
}