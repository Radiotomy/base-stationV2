import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Shield, ShieldOff, Ban, CheckCircle2, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

/**
 * Admin lifecycle actions for a single account: role, suspension, beta access.
 * Only rendered inside the admin user drawer — the platform additionally
 * enforces admin-only writes on other users at the API level.
 */
export default function UserRoleControls({ user, onChange }) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(user.suspension_reason || '');
  const isAdmin = user.role === 'admin';
  const suspended = !!user.is_suspended;

  const apply = async (patch, message) => {
    setBusy(true);
    try {
      const updated = await base44.entities.User.update(user.id, patch);
      onChange?.({ ...user, ...patch, ...(updated || {}) });
      toast.success(message);
    } catch (e) {
      toast.error(e?.message || 'Could not update this account');
    }
    setBusy(false);
  };

  return (
    <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Account controls</p>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm" variant="outline" disabled={busy}
          className="rounded-xl gap-2 text-xs"
          onClick={() => apply({ role: isAdmin ? 'user' : 'admin' }, isAdmin ? 'Admin access removed' : 'Promoted to admin')}
        >
          {isAdmin ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
          {isAdmin ? 'Revoke admin' : 'Make admin'}
        </Button>

        <Button
          size="sm" variant="outline" disabled={busy}
          className="rounded-xl gap-2 text-xs"
          onClick={() => apply({ beta_access: !user.beta_access }, user.beta_access ? 'Beta access revoked' : 'Beta access granted')}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          {user.beta_access ? 'Revoke beta' : 'Grant beta'}
        </Button>
      </div>

      <div className="pt-3 border-t border-border space-y-2">
        {suspended ? (
          <>
            <p className="text-xs text-red-300">
              Suspended{user.suspended_at ? ` on ${new Date(user.suspended_at).toLocaleDateString()}` : ''}
              {user.suspension_reason ? ` — ${user.suspension_reason}` : ''}
            </p>
            <Button
              size="sm" disabled={busy}
              className="rounded-xl gap-2 text-xs bg-emerald-600"
              onClick={() => apply({ is_suspended: false, suspension_reason: '', suspended_at: null }, 'Suspension lifted')}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Lift suspension
            </Button>
          </>
        ) : (
          <>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason shown to the user…"
              className="rounded-xl text-xs"
            />
            <Button
              size="sm" variant="destructive" disabled={busy || !reason.trim()}
              className="rounded-xl gap-2 text-xs"
              onClick={() => apply(
                { is_suspended: true, suspension_reason: reason.trim(), suspended_at: new Date().toISOString() },
                'Account suspended'
              )}
            >
              <Ban className="w-3.5 h-3.5" /> Suspend account
            </Button>
          </>
        )}
      </div>
    </div>
  );
}