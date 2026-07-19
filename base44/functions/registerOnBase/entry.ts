import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { ethers } from 'npm:ethers@6.13.4';

/**
 * End-to-end Base provenance registration — platform-paid.
 *
 * Actions:
 *  register       (any user)  — fingerprints the track, pins the provenance
 *                               bundle to IPFS, then the PLATFORM wallet signs
 *                               and broadcasts the on-chain anchor transaction
 *                               on Base mainnet. Artist never needs a wallet.
 *  finalize       (owner/adm) — record a tx hash on a pending record (legacy /
 *                               manual wallet flow).
 *  admin_update   (admin)     — set status / tx hash / wallet on any record.
 *  admin_repin    (admin)     — re-pin the IPFS bundle for a record.
 */

const isTxHash = (h) => /^0x[0-9a-fA-F]{64}$/.test(h || '');

// Normalize a pasted private key: trim whitespace/quotes, add 0x prefix if missing
function normalizePk(raw) {
  if (!raw) return null;
  let k = raw.trim().replace(/^["']|["']$/g, '');
  if (/^[0-9a-fA-F]{64}$/.test(k)) k = '0x' + k;
  return /^0x[0-9a-fA-F]{64}$/.test(k) ? k : null;
}

const toHex = (str) =>
  '0x' + Array.from(new TextEncoder().encode(str)).map((b) => b.toString(16).padStart(2, '0')).join('');

const sha256Hex = async (str) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

// Fingerprint + IPFS pin + pending registry & tx-log records
async function prepareRecord(base44, user, body) {
  const t = body.track || {};
  const fingerprint = await sha256Hex(JSON.stringify({
    title: t.title,
    artist: user.full_name,
    url: t.track_url,
    genre: t.genre || '',
    timestamp: new Date().toISOString(),
  }));

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

  const txLog = await base44.asServiceRole.entities.BlockchainTransaction.create({
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

  return { record, txLog, fingerprint, pin, pinError };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action || 'register';

    // ── wallet_check ── admin-only, safe diagnostic (never reveals the key) ─
    if (action === 'wallet_check') {
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const raw = Deno.env.get('PLATFORM_WALLET_PRIVATE_KEY') || '';
      const k = raw.trim().replace(/^["']|["']$/g, '');
      const pk = normalizePk(raw);
      let address = null;
      if (pk) {
        try { address = new ethers.Wallet(pk).address; } catch (_) { /* ignore */ }
      }
      return Response.json({
        set: raw.length > 0,
        valid: !!address,
        address,
        hints: address ? null : {
          length: k.length,
          starts_with_0x: k.startsWith('0x'),
          word_count: k.split(/\s+/).length,
          hex_only: /^(0x)?[0-9a-fA-F]+$/.test(k),
        },
      });
    }

    // ── register ── platform wallet pays & signs, artist needs nothing ─────
    if (action === 'register') {
      const t = body.track || {};
      if (!t.title || !t.track_url) {
        return Response.json({ error: 'track.title and track.track_url are required' }, { status: 400 });
      }

      const { record, txLog, fingerprint, pin, pinError } = await prepareRecord(base44, user, body);

      const pk = normalizePk(Deno.env.get('PLATFORM_WALLET_PRIVATE_KEY'));
      if (!pk) {
        return Response.json({
          registry_id: record.id,
          registration_status: 'pending',
          fingerprint_hash: fingerprint,
          metadata_uri: pin?.metadata_uri || '',
          gateway_url: pin?.gateway_url || '',
          pin_error: pinError,
          chain_error: 'Platform wallet key missing or invalid — saved as pending',
        });
      }

      try {
        const rpcUrl = Deno.env.get('BASE_RPC_URL') || 'https://mainnet.base.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
        const wallet = new ethers.Wallet(pk, provider);

        // 0-value self-transaction carrying the provenance anchor in calldata
        const anchorData = toHex(`BSTN1|${fingerprint}|${pin?.metadata_uri || ''}`);
        const tx = await wallet.sendTransaction({
          to: wallet.address,
          value: 0n,
          data: anchorData,
        });

        await base44.asServiceRole.entities.BaseTrackRegistry.update(record.id, {
          transaction_hash: tx.hash,
          wallet_address: wallet.address,
          registration_status: 'registered',
          registered_at: new Date().toISOString(),
        });
        await base44.asServiceRole.entities.BlockchainTransaction.update(txLog.id, {
          status: 'success',
          transaction_hash: tx.hash,
          wallet_address: wallet.address,
        });

        await base44.asServiceRole.entities.ActivityFeedItem.create({
          type: 'track_submitted',
          actor_name: user.full_name,
          actor_id: user.id,
          title: `registered "${t.title}" on Base blockchain`,
          entity_type: 'BaseTrackRegistry',
          entity_id: record.id,
        }).catch(() => {});

        return Response.json({
          registry_id: record.id,
          registration_status: 'registered',
          transaction_hash: tx.hash,
          wallet_address: wallet.address,
          fingerprint_hash: fingerprint,
          metadata_uri: pin?.metadata_uri || '',
          gateway_url: pin?.gateway_url || '',
          basescan_url: `https://basescan.org/tx/${tx.hash}`,
          pin_error: pinError,
        });
      } catch (chainErr) {
        // IPFS provenance is saved; record stays pending for admin retry
        return Response.json({
          registry_id: record.id,
          registration_status: 'pending',
          fingerprint_hash: fingerprint,
          metadata_uri: pin?.metadata_uri || '',
          gateway_url: pin?.gateway_url || '',
          pin_error: pinError,
          chain_error: chainErr.message,
        });
      }
    }

    // ── finalize ── manual tx hash on a pending record ─────────────────────
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

      return Response.json({ ok: true, registration_status: 'registered' });
    }

    // ── admin actions ─────────────────────────────────────────────────────
    if (action === 'admin_update' || action === 'admin_repin' || action === 'admin_retry_anchor') {
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

      if (action === 'admin_retry_anchor') {
        const pk = normalizePk(Deno.env.get('PLATFORM_WALLET_PRIVATE_KEY'));
        if (!pk) return Response.json({ error: 'Platform wallet key missing or invalid' }, { status: 500 });
        const rpcUrl = Deno.env.get('BASE_RPC_URL') || 'https://mainnet.base.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
        const wallet = new ethers.Wallet(pk, provider);
        const anchorData = toHex(`BSTN1|${rec.fingerprint_hash || ''}|${rec.metadata_uri || ''}`);
        const tx = await wallet.sendTransaction({ to: wallet.address, value: 0n, data: anchorData });

        await base44.asServiceRole.entities.BaseTrackRegistry.update(registry_id, {
          transaction_hash: tx.hash,
          wallet_address: wallet.address,
          registration_status: 'registered',
          registered_at: new Date().toISOString(),
        });
        const txs = await base44.asServiceRole.entities.BlockchainTransaction.filter(
          { related_entity: 'BaseTrackRegistry', related_entity_id: registry_id }, '-created_date', 1
        );
        if (txs[0]) {
          await base44.asServiceRole.entities.BlockchainTransaction.update(txs[0].id, {
            status: 'success', transaction_hash: tx.hash, wallet_address: wallet.address,
          });
        }
        return Response.json({ ok: true, transaction_hash: tx.hash, basescan_url: `https://basescan.org/tx/${tx.hash}` });
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