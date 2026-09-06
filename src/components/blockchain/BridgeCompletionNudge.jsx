import { Link2, ShieldPlus, Radio } from 'lucide-react';

/**
 * Surfaces the HALF-BRIDGED work: a release that is anchored but never published,
 * or published but never anchored.
 *
 * This exists because those two states are invisible today — each surface reports
 * its own half as successful, so a creator has no way to notice the other half was
 * never done. The nudge deliberately COUNTS rather than lists: the point is to
 * prompt the missing act, not to become a second library view.
 *
 * Renders nothing when both halves are complete, so a fully bridged catalog shows
 * no permanent scold.
 */
export default function BridgeCompletionNudge({ assets = [], registrations = [] }) {
  // Published to Audius but no Base anchor — the recording is public with nothing
  // proving who made it.
  const publishedUnanchored = assets.filter(
    (a) => a.metadata?.audius_track_id && !a.chain_registry_id,
  );

  // Anchored on Base but never released — provenance exists for a track no one can
  // hear. Only settled anchors count: a pending one has not made any claim yet.
  const anchoredUnpublished = registrations.filter(
    (r) => r.transaction_hash && !r.audius_track_id,
  );

  if (publishedUnanchored.length === 0 && anchoredUnpublished.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-black text-foreground">Complete the provenance bridge</h3>
      </div>

      <div className="space-y-2.5">
        {publishedUnanchored.length > 0 && (
          <div className="flex items-start gap-2.5">
            <ShieldPlus className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">
                {publishedUnanchored.length} released {publishedUnanchored.length === 1 ? 'track has' : 'tracks have'} no ownership anchor.
              </span>{' '}
              Register {publishedUnanchored.length === 1 ? 'it' : 'them'} above — because the release
              already exists, the Audius ID goes <span className="font-semibold">inside</span> the
              signed transaction, which is the strongest form of this claim.
            </p>
          </div>
        )}

        {anchoredUnpublished.length > 0 && (
          <div className="flex items-start gap-2.5">
            <Radio className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">
                {anchoredUnpublished.length} anchored {anchoredUnpublished.length === 1 ? 'record has' : 'records have'} no public release.
              </span>{' '}
              Publish from the Distribution tab to link {anchoredUnpublished.length === 1 ? 'it' : 'them'} to
              a live track. The anchor is already broadcast, so that link is recorded off-chain.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}