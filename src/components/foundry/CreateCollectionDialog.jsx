import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Check } from 'lucide-react';

// Build a patch collection by picking from public community patches.
export default function CreateCollectionDialog({ onClose, onCreated }) {
  const [pool, setPool] = useState(null);
  const [picked, setPicked] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', is_public: true });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.FoundryPlugin
      .filter({ is_public: true }, '-fork_count', 60)
      .then(setPool)
      .catch(() => setPool([]));
  }, []);

  const toggle = (id) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const save = async () => {
    if (!form.title.trim()) { toast({ title: 'Give the collection a name', variant: 'destructive' }); return; }
    if (!picked.length) { toast({ title: 'Pick at least one patch', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const me = await base44.auth.me();
      const created = await base44.entities.FoundryCollection.create({
        user_id: me.id,
        user_email: me.email,
        title: form.title.trim(),
        description: form.description,
        plugin_ids: picked,
        is_public: form.is_public,
      });
      onCreated(created);
    } catch (e) {
      toast({ title: 'Could not save collection', description: e.message, variant: 'destructive' });
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black">New patch collection</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Warm tape chains"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="What ties these patches together?"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Patches * <span className="text-muted-foreground text-xs">({picked.length} picked)</span></Label>
            {pool === null && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading public patches…
              </div>
            )}
            {pool && !pool.length && (
              <p className="text-xs text-muted-foreground py-3">No public patches to collect yet.</p>
            )}
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {(pool || []).map((p) => {
                const on = picked.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl border transition-colors ${
                      on ? 'border-[#FF9A4D] bg-[#FF9A4D]/10' : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    {on && <Check className="w-3.5 h-3.5 text-[#FF9A4D] shrink-0" />}
                    <span className="text-sm font-medium flex-1 truncate">{p.title}</span>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0">{p.category}</Badge>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={save} disabled={saving} className="flex-1 rounded-xl merc-button">
              {saving ? 'Saving…' : 'Save collection'}
            </Button>
            <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}