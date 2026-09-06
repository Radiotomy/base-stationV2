import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Sync Audius collectibles & badges — NOT AVAILABLE, and this says so explicitly.
 *
 * Audius' public API exposes no collectibles endpoint. A profile's Collectibles
 * shelf is assembled by the Audius CLIENT from the NFTs held in the wallets a
 * creator has linked, so there is nothing on the discovery nodes for a server to
 * read. The `getCollectibles` action this used to call was never implemented in
 * audiusClient for exactly that reason.
 *
 * It previously swallowed the missing action and returned `audius_unavailable`,
 * which is indistinguishable from a node being down — so this looked like a
 * transient failure that might clear on its own, and callers kept retrying a call
 * that cannot ever succeed.
 *
 * Identity sync (handle, name, avatar, follower counts, verified flag) DOES work
 * and is unaffected — see syncAudiusIdentity, which reads real discovery-node data.
 *
 * Payload: { audiusUserId? }  (defaults to current user's stored audius id)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let { audiusUserId } = await req.json().catch(() => ({}));
    audiusUserId = audiusUserId || user.metadata?.audius?.audius_user_id;
    if (!audiusUserId) return Response.json({ error: 'No Audius identity' }, { status: 400 });

    // Nothing is written to User.metadata: storing an empty collectibles array
    // would be indistinguishable from a creator who genuinely holds none, and any
    // surface reading it would then state that as a fact about their wallet.
    return Response.json({
      ok: false,
      reason: 'unsupported_by_audius',
      audius_user_id: audiusUserId,
      error:
        'Audius does not expose collectibles through its API — a profile\'s Collectibles shelf is built client-side from the creator\'s linked wallets, so there is no server-readable source.',
      identity_sync_available: true,
    }, { status: 501 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});