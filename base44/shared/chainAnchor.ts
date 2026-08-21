// Base provenance anchoring — the shared core used by BOTH the manual
// "Register a Track" flow (registerOnBase) and the opt-in automatic anchor
// (autoAnchorAsset).
//
// WHY IT LIVES HERE: anchoring is irreversible. A transaction cannot be edited
// or withdrawn, and a correction can only be published as a NEW anchor that
// names the one it supersedes. Two copies of that logic would eventually
// disagree about what gets hashed or what the calldata prefix means, and the
// disagreement would be permanent and public. So there is one implementation.
//
// The platform wallet pays and signs, so a creator never needs a wallet of their
// own — which is also why the private key is read here, server-side only, and
// never travels to any caller.

import { ethers } from 'npm:ethers@6.13.4';

/** Calldata prefix for a first-time anchor. */
const ANCHOR_PREFIX = 'BSTN1';
/** Calldata prefix for an anchor that corrects an earlier one. */
const CORRECTION_PREFIX = 'BSTN1C';

export const isTxHash = (h: string) => /^0x[0-9a-fA-F]{64}$/.test(h || '');

/** Normalize a pasted private key: trim whitespace/quotes, add 0x if missing. */
export function normalizePk(raw: string | null | undefined) {
  if (!raw) return null;
  let k = raw.trim().replace(/^["']|["']$/g, '');
  if (/^[0-9a-fA-F]{64}$/.test(k)) k = '0x' + k;
  return /^0x[0-9a-fA-F]{64}$/.test(k) ? k : null;
}

export const toHex = (str: string) =>
  '0x' + Array.from(new TextEncoder().encode(str)).map((b) => b.toString(16).padStart(2, '0')).join('');

export const sha256Hex = async (str: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Fingerprint the actual audio BYTES, so the anchor is verifiable against the
 * file itself rather than against a description of it. Falls back to a metadata
 * hash only when the audio cannot be downloaded — a weaker claim, but an honest
 * one, and better than refusing to record provenance at all.
 */
export async function fingerprintTrack(trackUrl: string, fallback: Record<string, unknown>) {
  try {
    const dl = await fetch(trackUrl);
    if (!dl.ok) throw new Error('download failed');
    const digest = await crypto.subtle.digest('SHA-256', await dl.arrayBuffer());
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (_) {
    return await sha256Hex(JSON.stringify({ ...fallback, timestamp: new Date().toISOString() }));
  }
}

/**
 * Fingerprint + IPFS pin + pending registry & tx-log rows.
 *
 * The rows are written BEFORE the chain call deliberately: if the broadcast
 * fails, the creator keeps a pending record showing what happened instead of the
 * whole registration silently vanishing.
 */
export async function prepareAnchorRecord(
  base44: any,
  artist: { id: string; full_name?: string; email?: string },
  body: any,
) {
  const t = body.track || {};
  const fingerprint = await fingerprintTrack(t.track_url, {
    title: t.title,
    artist: artist.full_name,
    url: t.track_url,
    genre: t.genre || '',
  });

  let pin: any = null;
  let pinError: string | null = null;
  try {
    const res = await base44.functions.invoke('pinToIPFS', {
      mode: 'track',
      track: {
        title: t.title,
        artist: artist.full_name,
        artist_id: artist.id,
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
  } catch (e: any) {
    pinError = e?.response?.data?.error || e.message;
  }

  const record = await base44.asServiceRole.entities.BaseTrackRegistry.create({
    artist_id: artist.id,
    artist_name: artist.full_name,
    artist_email: artist.email,
    track_title: t.title,
    track_url: t.track_url,
    cover_image_url: t.cover_image_url || '',
    genre: t.genre || '',
    ai_tools_used: t.ai_tools_used || '',
    ai_label: t.ai_label || undefined,
    description: t.description || '',
    supersedes_tx_hash: body.supersedes_tx_hash || undefined,
    correction_reason: body.correction_reason || undefined,
    wallet_address: body.wallet_address || '',
    fingerprint_hash: fingerprint,
    metadata_uri: pin?.metadata_uri || '',
    registration_status: 'pending',
    network: 'base-mainnet',
  });

  const txLog = await base44.asServiceRole.entities.BlockchainTransaction.create({
    user_id: artist.id,
    user_email: artist.email,
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

/**
 * Sign and broadcast the anchor: a 0-value self-transaction carrying the
 * provenance claim in calldata. A correction uses the BSTN1C prefix and names
 * the transaction it supersedes, so the retraction is provable on-chain rather
 * than only in our own database.
 *
 * Throws when the wallet is unconfigured or the broadcast fails; the caller
 * decides how to report a record that stays pending.
 */
export async function broadcastAnchor(
  base44: any,
  { record, txLog, fingerprint, metadataUri = '', supersedes = '' }: {
    record: any; txLog?: any; fingerprint: string; metadataUri?: string; supersedes?: string;
  },
) {
  const pk = normalizePk(Deno.env.get('PLATFORM_WALLET_PRIVATE_KEY'));
  if (!pk) throw new Error('Platform wallet key missing or invalid');

  const rpcUrl = Deno.env.get('BASE_RPC_URL') || 'https://mainnet.base.org';
  const provider = new ethers.JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
  const wallet = new ethers.Wallet(pk, provider);

  const anchorData = toHex(
    supersedes
      ? `${CORRECTION_PREFIX}|${fingerprint}|${metadataUri}|supersedes:${supersedes}`
      : `${ANCHOR_PREFIX}|${fingerprint}|${metadataUri}`,
  );
  const tx = await wallet.sendTransaction({ to: wallet.address, value: 0n, data: anchorData });

  await base44.asServiceRole.entities.BaseTrackRegistry.update(record.id, {
    transaction_hash: tx.hash,
    wallet_address: wallet.address,
    registration_status: 'registered',
    registered_at: new Date().toISOString(),
  });
  if (txLog) {
    await base44.asServiceRole.entities.BlockchainTransaction.update(txLog.id, {
      status: 'success',
      transaction_hash: tx.hash,
      wallet_address: wallet.address,
    }).catch(() => {});
  }

  // Point the superseded record at its replacement, so a reader who arrives at
  // the bad anchor is always led to the authoritative one.
  if (supersedes) {
    const prior = await base44.asServiceRole.entities.BaseTrackRegistry
      .filter({ transaction_hash: supersedes }, '-created_date', 1).catch(() => []);
    if (prior?.[0]) {
      await base44.asServiceRole.entities.BaseTrackRegistry.update(prior[0].id, {
        superseded_by_tx_hash: tx.hash,
      }).catch(() => {});
    }
  }

  return { transaction_hash: tx.hash, wallet_address: wallet.address };
}