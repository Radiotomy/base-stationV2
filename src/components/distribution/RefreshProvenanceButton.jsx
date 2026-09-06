import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

/**
 * Restates a live Audius release's provenance footer from the CURRENT stored record.
 *
 * Exists because a COS score or disclosure label can be corrected after a track is
 * already published, and until now that correction only reached BASE Station's own
 * screens while the live release kept declaring the superseded one.
 */
export default function RefreshProvenanceButton({ asset }) {
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('refreshAudiusMetadata', { assetId: asset.id });
      const data = res?.data?.data || res?.data;
      if (data?.unchanged) {
        toast.success('Already up to date — the live release matches your current score and label.');
      } else {
        toast.success(`Updated on Audius: ${(data?.updated_fields || []).join(', ') || 'provenance footer'}`);
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Could not update the release');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={refresh}
      disabled={busy}
      className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
      title="Push your current COS score and AI disclosure label to the live Audius release"
    >
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
      <span className="ml-1 hidden sm:inline">Refresh provenance</span>
    </Button>
  );
}