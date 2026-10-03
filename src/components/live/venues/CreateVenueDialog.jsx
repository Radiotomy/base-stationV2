import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import VenueTemplateGrid from './VenueTemplateGrid';
import { DEFAULT_TEMPLATE_KEY, getVenueTemplate } from '@/lib/live/venueTemplates';
import VenueImageField from './VenueImageField';

export default function CreateVenueDialog({ open, onOpenChange, onCreated }) {
  const [templateKey, setTemplateKey] = useState(DEFAULT_TEMPLATE_KEY);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState('');
  const [busy, setBusy] = useState(false);
  const tpl = getVenueTemplate(templateKey);
  const artContext = [
    tpl && `Style: ${tpl.name}${tpl.description ? ` (${tpl.description})` : ''}`,
    name.trim() && `Venue name: ${name.trim()}`,
    description.trim() && `Vibe: ${description.trim()}`,
  ].filter(Boolean).join('. ');

  const create = async () => {
    if (!name.trim()) { toast.error('Give your venue a name'); return; }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('createPortalVenue', {
        name: name.trim(),
        description: description.trim(),
        templateKey,
        coverImageUrl: cover.trim(),
      });
      if (!res?.data?.roomId) throw new Error(res?.data?.error || 'Venue creation failed');
      toast.success('Your 3D venue is ready');
      setName(''); setDescription(''); setCover(''); setTemplateKey(DEFAULT_TEMPLATE_KEY);
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a 3D Venue</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">Pick your venue</p>
            <VenueTemplateGrid value={templateKey} onChange={setTemplateKey} disabled={busy} />
          </div>

          <div className="space-y-2">
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Venue name" className="h-9 text-sm rounded-lg" />
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your venue (optional)" rows={2} className="text-sm rounded-lg resize-none" />
            <VenueImageField label="Cover image (optional)" kind="cover" value={cover} onChange={setCover} context={artContext} disabled={busy} />
          </div>

          <Button onClick={create} disabled={busy} className="w-full rounded-lg h-10 font-bold gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {busy ? 'Building your world…' : 'Create Venue'}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            No Portals account needed — your venue is hosted for you.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}