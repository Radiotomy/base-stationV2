import { useState } from 'react';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function VenueBrandingCard({ venue, onUpdated }) {
  const [cover, setCover] = useState(venue.cover_image_url || '');
  const [loadingImage, setLoadingImage] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('updateVenueBranding', {
        venueId: venue.id,
        coverImageUrl: cover.trim(),
        loadingImageUrl: loadingImage.trim(),
      });
      if (res?.data?.error) throw new Error(res.data.error);
      toast.success('Branding applied to your room');
      onUpdated?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    }
    setBusy(false);
  };

  return (
    <div className="merc-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ImageIcon className="w-4 h-4 text-accent" />
        <p className="font-bold text-sm">Venue Branding</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Your own artwork on the room card and on the loading screen fans see while your world streams in.
      </p>

      <div className="space-y-2">
        <Input value={cover} onChange={(e) => setCover(e.target.value)} disabled={busy}
          placeholder="Cover / room card image URL (https)" className="h-9 text-sm rounded-lg" />
        <Input value={loadingImage} onChange={(e) => setLoadingImage(e.target.value)} disabled={busy}
          placeholder="Loading screen image URL (https)" className="h-9 text-sm rounded-lg" />
        {cover ? (
          <img src={cover} alt="Venue cover preview" className="w-full h-32 object-cover rounded-lg border border-border" />
        ) : null}
      </div>

      <Button onClick={save} disabled={busy} className="rounded-lg h-9 text-sm font-bold gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {busy ? 'Applying…' : 'Apply Branding'}
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Leave the loading screen blank to use the default Portals splash.
      </p>
    </div>
  );
}