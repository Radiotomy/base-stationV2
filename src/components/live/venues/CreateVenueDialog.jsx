import { useState } from 'react';
import { Loader2, Disc3, Armchair, Tent, Square } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { VENUE_TEMPLATES } from '@/lib/live/venueTemplates';

const ICONS = { Disc3, Armchair, Tent, Square };

export default function CreateVenueDialog({ open, onOpenChange, onCreated }) {
  const [templateKey, setTemplateKey] = useState('club');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState('');
  const [busy, setBusy] = useState(false);

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
      setName(''); setDescription(''); setCover(''); setTemplateKey('club');
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
            <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">Starter world</p>
            <div className="grid grid-cols-2 gap-2">
              {VENUE_TEMPLATES.map((t) => {
                const Icon = ICONS[t.icon] || Square;
                const active = templateKey === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTemplateKey(t.key)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      active ? 'border-accent bg-white/5' : 'border-border hover:border-white/20'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1.5 ${active ? 'text-accent' : 'text-muted-foreground'}`} />
                    <p className="text-sm font-bold text-foreground">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{t.tagline}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Venue name" className="h-9 text-sm rounded-lg" />
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your venue (optional)" rows={2} className="text-sm rounded-lg resize-none" />
            <Input value={cover} onChange={(e) => setCover(e.target.value)}
              placeholder="Cover image URL (https, optional)" className="h-9 text-sm rounded-lg" />
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