// Hybrid venue ownership: connect / disconnect / inspect a creator's own Portals
// access key. The key is a bearer credential for that creator's whole Portals
// account, so it is verified against Portals before storage and NEVER returned —
// callers only ever receive a connection status.
//
// Actions: "status" (default) | "connect" | "disconnect"

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyKey, platformConfigured } from '../../shared/portalsApi.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'status';

    const rows = await base44.asServiceRole.entities.PortalCredential.filter({ user_id: user.id });
    const existing = rows?.[0] || null;

    if (action === 'status') {
      return Response.json({
        connected: existing?.status === 'connected',
        label: existing?.label || '',
        verified_at: existing?.verified_at || null,
        platform_available: platformConfigured(),
      });
    }

    if (action === 'connect') {
      const accessKey = (body.accessKey || '').trim();
      if (!accessKey) return Response.json({ connected: false, error: 'Access key required' }, { status: 400 });

      // Verify before storing — an unverified key would only fail later, at
      // room-create time, with an error the creator can't act on.
      const check = await verifyKey(accessKey);
      if (!check.valid) {
        return Response.json({ connected: false, error: check.error || 'Portals rejected that key' }, { status: 400 });
      }

      const payload = {
        user_id: user.id,
        user_email: user.email,
        access_key: accessKey,
        portal_uid: check.uid || '',
        label: (body.label || '').slice(0, 80),
        status: 'connected',
        verified_at: new Date().toISOString(),
      };

      if (existing) {
        await base44.asServiceRole.entities.PortalCredential.update(existing.id, payload);
      } else {
        await base44.asServiceRole.entities.PortalCredential.create(payload);
      }

      return Response.json({ connected: true, label: payload.label });
    }

    if (action === 'disconnect') {
      // Keep the row: venues already created under this key remain
      // creator-owned and still need it resolvable for management writes.
      if (existing) {
        await base44.asServiceRole.entities.PortalCredential.update(existing.id, { status: 'disconnected' });
      }
      return Response.json({ connected: false });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}