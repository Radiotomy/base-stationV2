import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Globe, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Publishes an existing loop to the shared community library (or pulls it back
 * to private). Uploading has always had a "share" checkbox, but loops already
 * in the library — especially SoundForge generations — had no way to be shared
 * after the fact.
 */
export default function ShareToCommunityToggle({ loop, onChanged }) {
  const [busy, setBusy] = useState(false);
  const isPublic = !!loop.is_public;

  const toggle = async () => {
    setBusy(true);
    try {
      await base44.entities.LoopSample.update(loop.id, { is_public: !isPublic });
      toast.success(isPublic ? 'Removed from community library' : 'Shared to community library');
      onChanged?.(loop.id, !isPublic);
    } catch (e) {
      toast.error('Could not update: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="outline" className="w-full" onClick={toggle} disabled={busy}>
      {busy ? (
        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
      ) : isPublic ? (
        <Globe className="w-3.5 h-3.5 mr-1.5" />
      ) : (
        <Lock className="w-3.5 h-3.5 mr-1.5" />
      )}
      {isPublic ? 'Shared — make private' : 'Share to community'}
    </Button>
  );
}