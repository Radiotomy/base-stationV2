import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Headphones, Loader2, CheckCircle2, Lock } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Reusable "Publish to Audius" button.
 * Disabled if origin === "loudly" or required metadata missing.
 */
export default function PublishToAudiusButton({ asset, className = '', onPublished }) {
  const [loading, setLoading] = useState(false);
  const [published, setPublished] = useState(!!asset?.metadata?.audius_track_id);

  const origin = asset?.origin || 'creator';
  const isBlocked = origin === 'loudly';
  const missingMeta = !asset?.title || !asset?.file_url;
  const disabled = isBlocked || missingMeta || loading || published;

  const handlePublish = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('publishToAudius', { assetId: asset.id });
      if (res.data?.audius_track_id) {
        setPublished(true);
        toast.success('Published to Audius!', { icon: '🎧' });
        onPublished?.(res.data);
      } else {
        toast.error(res.data?.error || 'Publish failed');
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Publish failed');
    } finally {
      setLoading(false);
    }
  };

  if (published) {
    return (
      <Button disabled variant="outline" className={`gap-2 text-emerald-400 border-emerald-500/30 ${className}`}>
        <CheckCircle2 className="w-4 h-4" /> Published to Audius
      </Button>
    );
  }

  if (isBlocked) {
    return (
      <Button disabled variant="outline" className={`gap-2 text-muted-foreground ${className}`}>
        <Lock className="w-4 h-4" /> Audius blocked (Loudly content)
      </Button>
    );
  }

  return (
    <Button onClick={handlePublish} disabled={disabled} className={`gap-2 bg-emerald-600 hover:bg-emerald-500 ${className}`}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Headphones className="w-4 h-4" />}
      {loading ? 'Publishing…' : 'Publish to Audius'}
    </Button>
  );
}