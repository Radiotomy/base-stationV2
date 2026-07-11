import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Headphones, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PublishSessionToAudiusButton({ sessionId }) {
  const [bundle, setBundle] = useState(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    base44.entities.LiveSessionBundle.filter({ session_id: sessionId }, '-created_date', 1)
      .then(r => setBundle(r[0] || null))
      .catch(() => {});
  }, [sessionId]);

  if (!bundle) return null;

  if (bundle.audius_track_id) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 px-3 py-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" /> On Audius
      </span>
    );
  }

  const publish = async () => {
    setPublishing(true);
    try {
      const r = await base44.functions.invoke('publishLiveSessionBundle', { bundleId: bundle.id });
      if (r.data?.audius_track_id) {
        setBundle(b => ({ ...b, audius_track_id: r.data.audius_track_id }));
        toast.success('Session published to Audius!', { icon: '🎧' });
      } else {
        toast.error(r.data?.error || 'Publish failed');
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={publish} disabled={publishing}
      className="rounded-xl gap-1.5 border-emerald-500/30 text-emerald-300 hover:text-emerald-200">
      {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Headphones className="w-3.5 h-3.5" />}
      {publishing ? 'Publishing…' : 'Publish to Audius'}
    </Button>
  );
}