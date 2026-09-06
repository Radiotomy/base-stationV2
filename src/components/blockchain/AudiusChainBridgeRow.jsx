import { Link2, ShieldCheck, Database } from 'lucide-react';

/**
 * The Audius ↔ Base bridge, shown wherever a work's provenance is displayed.
 *
 * The whole point of this row is the DISTINCTION between the two link strengths, so
 * it never renders them identically:
 *
 *   in_calldata        — the release id is inside the signed Base transaction, so the
 *                        pairing is provable on-chain by anyone.
 *   off_chain_backlink — the anchor predates the release, so calldata could not name
 *                        it; BASE Station's own record is what asserts the pairing.
 *
 * Calldata is immutable, so a back-link is never upgraded in place. Presenting the
 * weaker claim as the stronger one would be the one failure this component exists to
 * prevent, which is why the basis is stated in words and not just a colour.
 *
 * Props: { audiusTrackId, audiusPermalink, linkBasis, txHash }
 */
export default function AudiusChainBridgeRow({ audiusTrackId, audiusPermalink, linkBasis, txHash }) {
  // Nothing to bridge: either the work was never published, or never anchored.
  if (!audiusTrackId || !txHash) return null;

  const onChain = linkBasis === 'in_calldata';
  const audiusUrl = audiusPermalink || `https://audius.co/tracks/${audiusTrackId}`;

  return (
    <div className="p-3 rounded-xl bg-black/20 border border-white/10 space-y-2">
      <div className="flex items-center gap-1.5">
        <Link2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
        <p className="text-xs font-semibold text-white/50 uppercase">Audius ↔ Chain Link</p>
      </div>

      <div className="flex items-start gap-1.5">
        {onChain
          ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
          : <Database className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />}
        <p className="text-xs leading-relaxed text-white/60">
          {onChain ? (
            <>
              <span className="font-bold text-emerald-400">Provable on-chain.</span>{' '}
              The Audius release is named inside the signed Base transaction, so anyone
              can verify the pairing without trusting BASE Station.
            </>
          ) : (
            <>
              <span className="font-bold text-amber-400">Recorded by BASE Station.</span>{' '}
              This track was anchored before it was released, so the transaction could
              not name it. The link is our own record, not an on-chain fact.
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-3 pt-0.5">
        <a
          href={audiusUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-white hover:underline"
        >
          View on Audius
        </a>
        <a
          href={`https://basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-white hover:underline"
        >
          Verify on BaseScan
        </a>
      </div>
    </div>
  );
}