import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Mint a Collectible to Audius — NOT POSSIBLE, and this function exists to say so
 * precisely rather than to keep trying.
 *
 * Audius Collectibles are not minted BY Audius. They are NFTs the creator already
 * holds in a third-party wallet (Ethereum or Solana) which Audius then surfaces on
 * their profile once that wallet is linked in the Audius dashboard. There is no
 * Audius mint endpoint to call, and no amount of credentials would produce one.
 *
 * So this returns an explicit, permanent 501 naming the real path. It previously
 * degraded to `audius_unavailable`, which reads as a transient outage and invited
 * a retry that can never succeed — and left the impression that a missing key was
 * the only thing standing in the way.
 *
 * To actually put a BASE Station collectible on an Audius profile the creator must
 * mint it on-chain themselves (their own wallet, their own contract) and link that
 * wallet to Audius. BASE Station can help with the FIRST half of that — see the
 * Base anchoring path — but the mint and the wallet link are the creator's own acts.
 *
 * Payload: { collectibleId }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { collectibleId } = await req.json();
    if (!collectibleId) return Response.json({ error: 'collectibleId required' }, { status: 400 });

    const arr = await base44.asServiceRole.entities.Collectible.filter({ id: collectibleId });
    const c = arr[0];
    if (!c) return Response.json({ error: 'Not found' }, { status: 404 });
    if (c.creator_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Ownership was verified above so the caller gets a definitive answer about
    // THEIR collectible rather than a generic refusal — but the answer is a
    // permanent no, not a retryable failure.
    return Response.json({
      ok: false,
      reason: 'unsupported_by_audius',
      collectible: { id: c.id, name: c.name },
      error:
        'Audius has no minting API. Audius Collectibles are NFTs you mint yourself in your own wallet, which Audius then displays once you link that wallet in your Audius dashboard.',
      next_steps: [
        'Mint the collectible on-chain from a wallet you control.',
        'Link that wallet under "Connect Other Wallet" in your Audius dashboard.',
        'Audius will then surface it as a Collectible on your profile automatically.',
      ],
    }, { status: 501 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});