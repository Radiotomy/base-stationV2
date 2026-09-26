import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Headphones, CheckCircle2, ExternalLink } from 'lucide-react';
import AudiusConnectionCard from '@/components/distribution/AudiusConnectionCard';
import useAudiusBrowserPublish from '@/hooks/useAudiusBrowserPublish';

const PHASE_LABEL = { signin: 'Signing in to Audius…', preparing: 'Preparing release…', uploading: 'Uploading WAV…', registering: 'Registering on Audius…' };

/**
 * Distribute a protected export to the creator's own Audius account. Unlocks only
 * once the watermark cascade has finalized, the C2PA manifest is sealed and the
 * anchor decision is made — so the release description (built server-side by
 * the shared Audius compliance package) carries the COS score and the Basescan
 * link of the anchor.
 */
export default function DistributeToAudiusPanel({ asset, stages }) {
  const [connected, setConnected] = useState(null);
  const [error, setError] = useState('');
  const [release, setRelease] = useState(null);
  const { publish, phase } = useAudiusBrowserPublish();

  useEffect(() => {
    base44.functions.invoke('audiusConnection', { action: 'status' })
      .then((r) => setConnected(!!r.data?.data?.connected)).catch(() => setConnected(false));
  }, []);

  const ready = stages.sealed === 'done' && ['done', 'skipped', 'failed'].includes(stages.anchor);
  const existingId = release?.id || asset?.metadata?.audius_track_id;
  const busy = phase !== 'idle';

  const distribute = async () => {
    setError('');
    try {
      const id = await publish(asset);
      const fresh = await base44.entities.UserAsset.get(asset.id);
      setRelease({ id, permalink: fresh?.metadata?.audius_permalink });
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    }
  };

  if (connected === null) return <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking your Audius connection…</p>;
  if (!connected) return <AudiusConnectionCard onConnected={() => setConnected(true)} />;

  return (
    <div className="rounded-xl border border-border p-4 space-y-2">
      <p className="font-medium flex items-center gap-2"><Headphones className="w-4 h-4 text-emerald-400" /> Distribute to Audius</p>
      {existingId ? (
        <p className="text-sm text-emerald-300 flex items-center gap-2 flex-wrap">
          <CheckCircle2 className="w-4 h-4" /> Live on Audius
          {(release?.permalink || asset?.metadata?.audius_permalink) && (
            <a href={release?.permalink || asset.metadata.audius_permalink} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">
              View track <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {ready
              ? 'Uploads the watermarked WAV with your project name, snapshot and BPM. The description includes your ownership score and the Base anchor link.'
              : 'Unlocks once watermarking and C2PA sealing finish.'}
          </p>
          <Button onClick={distribute} disabled={!ready || busy} className="gap-2 bg-emerald-600 hover:bg-emerald-500">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Headphones className="w-4 h-4" />}
            {busy ? PHASE_LABEL[phase] : 'Distribute to Audius'}
          </Button>
        </>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}