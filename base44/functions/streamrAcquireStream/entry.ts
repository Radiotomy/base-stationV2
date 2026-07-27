import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { StreamrClient, StreamPermission } from 'npm:@streamr/sdk@103.3.1';
import { secrets } from 'base44:runtime';

/**
 * Phase 6 — Browser-direct Streamr live audio: stream acquisition.
 *
 * Called once by the performer's browser when it starts publishing. The
 * browser generates an ephemeral Ethereum identity (private key stays in the
 * browser) and sends only the *public address* here. Using the server-side
 * STREAMR_PRIVATE_KEY (the stream owner, holding POL on Polygon):
 *   1. create / fetch the per-session stream  -> 0xOWNER/basestation/live/<roomId>
 *   2. grant PUBLIC subscribe (so any fan can read with no identity)
 *   3. grant PUBLISH to the performer's ephemeral browser address
 *   4. persist the resolved stream id onto the LiveSession so fans can find it
 *
 * Gracefully no-ops when the owner key is not configured, so the live feature
 * simply falls back to "sync" audio mode.
 *
 * Payload: { roomId, publisherAddress }
 * Returns: { available: true, streamId } | { available: false, reason }
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { roomId, publisherAddress } = await req.json();
    if (!roomId) return Response.json({ error: 'roomId required' }, { status: 400 });

    const privateKey = secrets.get('STREAMR_PRIVATE_KEY');
    if (!privateKey) {
      return Response.json({ available: false, reason: 'streamr_disabled' });
    }

    const client = new StreamrClient({ auth: { privateKey } });

    // The SDK prepends the owner's Ethereum address to the path, producing
    // the canonical stream id `0xOWNER/basestation/live/<roomId>`.
    const stream = await client.getOrCreateStream({ id: `/basestation/live/${roomId}` });
    const streamId = stream.id;

    // Grant public read + grant publish to the performer's ephemeral address.
    // Duplicate grants are tolerated (caught); Promise.all keeps on-chain gas
    // round-trips to one pipelined batch.
    const grants = [];
    grants.push(
      stream.grantPermissions({ public: true, permissions: [StreamPermission.SUBSCRIBE] })
        .catch(() => {})
    );
    if (publisherAddress) {
      grants.push(
        stream.grantPermissions({ userId: publisherAddress, permissions: [StreamPermission.PUBLISH] })
          .catch(() => {})
      );
    }
    await Promise.all(grants);

    // Persist the stream id so fans (subscribers) can locate it.
    try {
      await base44.asServiceRole.entities.LiveSession.updateMany(
        { id: roomId },
        { $set: { streamr_stream_id: streamId, streamr_enabled: true } }
      );
    } catch { /* best effort — fans will still be able to join a retrying acquire */ }

    return Response.json({ available: true, streamId });
  } catch (error) {
    return Response.json({ error: error.message, reason: 'streamr_acquire_failed' }, { status: 500 });
  }
}