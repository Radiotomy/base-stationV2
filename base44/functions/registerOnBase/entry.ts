import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * End-to-end Base provenance registration.
 *
 * Actions:
 *  prepare        (any user)  — fingerprints the track, pins the provenance bundle
 *                               to IPFS, creates a pending BaseTrackRegistry record
 *                               + BlockchainTransaction log, returns the anchor
 *                               calldata for the client wallet to sign.
 *  finalize       (owner/adm) — records the real on-chain tx hash, flips the
 *                               registry record to "registered".
 *  admin_update   (admin)     — set status / tx hash / wallet on any record.
 *  admin_repin    (admin)     — re-pin the IPFS bundle for a record missing
 *                               (or with a broken) metadata_uri.
 */

const isTxHash = (h) => /^0x[0-9a-fA-F]{64}$/.test(h || '');

const toHex = (str) =>
  '0x' + Array.from(new TextEncoder().encode(str)).map((b) => b.toString(16).padStart(2, '0')).join('');

const sha256Hex = async (str) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action || 'prepare';

    // ── prepare ───────────────────────────────────────────────────────────
    if (action === 'prepare') {
      const t = body.track || {};
      if (!t.title || !t.track_url) {
        return Response.json({ error: 'track.title and track.track_url are required' }, { status: 400 });
      }

      const fingerprint = await sha256Hex(JSON.stringify({
        title: t.title,
        artist: user.full_name,
        url: t.track_url,
        genre: t.genre || '',
        timestamp: new Date().toISOString(),
      }));

      // Pin the full provenance bundle (audio + cover + COS metadata JSON)
      let pin = null;
      let pinError = null;
      try {
        const res = await base44.functions.invoke('pinToIPFS', {
          mode: 'track',
          track: {
            title: t.title,
            artist: user.full_name,
            artist_id: user.id,
            asset_id: t.asset_id || null,
            file_url: t.track_url,
            cover_url: t.cover_image_url || '',
            genre: t.genre || '',
            ai_tools_used: t.ai_tools_used || '',
            description: t.description || '',
            fingerprint_hash: fingerprint,
            blockchain: 'base',
          },
        });
        pin = res.data;
      } catch (e) {
        pinError = e?.response?.data?.error || e.message;
      }

      const record = await base44.asServiceRole.entities.BaseTrackRegistry.create({
        artist_id: user.id,
        artist_name: user.full_name,
        artist_email: user.email,
        track_title: t.title,
        track_url: t.track_url,
        cover_image_url: t.cover_image_url || '',
        genre: t.genre || '',
        ai_tools_used: t.ai_tools_used || '',
        ai_label: t.ai_label || undefined,
        description: t.description || '',
        wallet_address: body.wallet_address || '',
        fingerprint_hash: fingerprint,
        metadata_uri: pin?.metadata_uri || '',
        registration_status: 'pending',
        network: 'base-mainnet',
      });

      await base44.asServiceRole.entities.BlockchainTransaction.create({
        user_id: user.id,
        user_email: user.email,
        blockchain: 'base',
        network: 'base-mainnet',
        action: 'register_track',
        status: 'pending',
        wallet_address: body.wallet_address || '',
        related_entity: 'BaseTrackRegistry',
        related_entity_id: record.id,
        metadata: { metadata_uri: pin?.metadata_uri || '', fingerprint_hash: fingerprint, pin_error: pinError },
        description: `Provenance anchor for "${t.title}"`,
      });

      // Calldata the client wallet embeds in the anchor transaction
      const anchorData = toHex(`BSTN1|${fingerprint}|${pin?.metadata_uri || ''}`);

      return Response.json({
        registry_id: record.id,
        fingerprint_hash: fingerprint,
        metadata_uri: pin?.metadata_uri || '',
        gateway_url: pin?.gateway_url || '',
        anchor_data: anchorData,
        pin_error: pinError,
      });
    }

    // ── finalize ──────────────────────────────────────────────────────────
    if (action === 'finalize') {
      const { registry_id, transaction_hash, wallet_address } = body;
      if (!registry_id) return Response.json({ error: 'registry_id required' }, { status: 400 });
      if (!isTxHash(transaction_hash)) {
        return Response.json({ error: 'transaction_hash must be a 0x-prefixed 64-hex-char hash' }, { status: 400 });
      }

      const rows = await base44.asServiceRole.entities.BaseTrackRegistry.filter({ id: registry_id });
      const rec = rows[0];
      if (!rec) return Response.json({ error: 'Registry record not found' }, { status: 404 });
      if (rec.artist_id !== user.id && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      await base44.asServiceRole.entities.BaseTrackRegistry.update(registry_id, {
        transaction_hash,
        wallet_address: wallet_address || rec.wallet_address,
        registration_status: 'registered',
        registered_at: new Date().toISOString(),
      });

      const txs = await base44.asServiceRole.entities.BlockchainTransaction.filter(
        { related_entity: 'BaseTrackRegistry', related_entity_id: registry_id }, '-created_date', 1
      );
      if (txs[0]) {
        await base44.asServiceRole.entities.BlockchainTransaction.update(txs[0].id, {
          status: 'success',
          transaction_hash,
          wallet_address: wallet_address || txs[0].wallet_address,
        });
      }

      await base44.asServiceRole.entities.ActivityFeedItem.create({
        type: 'track_submitted',
        actor_name: user.full_name,
        actor_id: user.id,
        title: `registered "${rec.track_title}" on Base blockchain`,
        entity_type: 'BaseTrackRegistry',
        entity_id: registry_id,
      }).catch(() => {});

      return Response.json({ ok: true, registration_status: 'registered' });
    }

    // ── admin actions ─────────────────────────────────────────────────────
    if (action === 'admin_update' || action === 'admin_repin') {
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

      const { registry_id } = body;
      if (!registry_id) return Response.json({ error: 'registry_id required' }, { status: 400 });
      const rows = await base44.asServiceRole.entities.BaseTrackRegistry.filter({ id: registry_id });
      const rec = rows[0];
      if (!rec) return Response.json({ error: 'Registry record not found' }, { status: 404 });

      if (action === 'admin_repin') {
        const res = await base44.functions.invoke('pinToIPFS', {
          mode: 'track',
          track: {
            title: rec.track_title,
            artist: rec.artist_name,
            artist_id: rec.artist_id,
            file_url: rec.track_url,
            cover_url: rec.cover_image_url || '',
            genre: rec.genre || '',
            ai_tools_used: rec.ai_tools_used || '',
            description: rec.description || '',
            fingerprint_hash: rec.fingerprint_hash || '',
            blockchain: 'base',
          },
        });
        const pin = res.data;
        await base44.asServiceRole.entities.BaseTrackRegistry.update(registry_id, {
          metadata_uri: pin.metadata_uri,
        });
        return Response.json({ ok: true, metadata_uri: pin.metadata_uri, gateway_url: pin.gateway_url });
      }

      // admin_update
      const { registration_status, transaction_hash, wallet_address } = body;
      const updates = {};
      if (registration_status) updates.registration_status = registration_status;
      if (transaction_hash !== undefined) {
        if (transaction_hash && !isTxHash(transaction_hash)) {
          return Response.json({ error: 'transaction_hash must be a 0x-prefixed 64-hex-char hash' }, { status: 400 });
        }
        updates.transaction_hash = transaction_hash;
      }
      if (wallet_address !== undefined) updates.wallet_address = wallet_address;
      if (registration_status === 'registered') updates.registered_at = new Date().toISOString();
      await base44.asServiceRole.entities.BaseTrackRegistry.update(registry_id, updates);

      // Keep the transaction log in sync
      const txs = await base44.asServiceRole.entities.BlockchainTransaction.filter(
        { related_entity: 'BaseTrackRegistry', related_entity_id: registry_id }, '-created_date', 1
      );
      if (txs[0] && registration_status) {
        const map = { registered: 'success', failed: 'failed', pending: 'pending' };
        await base44.asServiceRole.entities.BlockchainTransaction.update(txs[0].id, {
          status: map[registration_status] || txs[0].status,
          ...(transaction_hash ? { transaction_hash } : {}),
        });
      }

      return Response.json({ ok: true });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});