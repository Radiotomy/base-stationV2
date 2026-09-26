import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';
import { Loader2, Save, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { updateProject } from '@/lib/audiotool/audiotoolProjects';

// Audiotool TrackLicense enum values.
const LICENSES = [
  [0, 'Unspecified'], [4, 'All rights reserved'], [2, 'Creative Commons'],
  [3, 'Creative Commons Non-Commercial'], [5, 'Royalty free'], [1, 'No rights reserved'],
];

const fromMeta = (m) => ({
  displayName: m.displayName || '', description: m.description || '',
  bpm: m.bpm ? String(Math.round(m.bpm * 100) / 100) : '', tags: (m.tags || []).join(', '),
  license: m.license ?? 0, copyAllowed: !!m.copyAllowed, downloadAllowed: !!m.downloadAllowed,
});

const toFields = (f) => ({
  displayName: f.displayName.trim(), description: f.description,
  bpm: Number(f.bpm) || 0, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
  license: Number(f.license), copyAllowed: f.copyAllowed, downloadAllowed: f.downloadAllowed,
});

export default function ProjectPropertiesPanel({ at, meta, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (meta) setForm(fromMeta(meta)); }, [meta]);
  if (!meta || !form) return null;

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));

  const save = async () => {
    const next = toFields(form);
    const prev = toFields(fromMeta(meta));
    const changed = Object.fromEntries(Object.entries(next).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(prev[k])));
    if (!Object.keys(changed).length) return toast.info('Nothing changed.');
    setSaving(true);
    try {
      const updated = await updateProject(at, meta.name, changed);
      onSaved(updated || { ...meta, ...changed });
      toast.success('Project properties saved to Audiotool.');
    } catch (e) {
      toast.error(e.cause?.message || e.message);
    }
    setSaving(false);
  };

  return (
    <section className="rounded-2xl border border-border p-5 space-y-4">
      <div>
        <h3 className="font-bold flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" /> Project Properties <InfoTip text={TIPS.properties} size="sm" side="bottom" /></h3>
        <p className="text-sm text-muted-foreground">Edits save straight to the Audiotool project. Cover art can only be changed inside Audiotool.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Title</Label><Input value={form.displayName} onChange={set('displayName')} /></div>
        <div className="space-y-1"><Label>BPM</Label><Input type="number" min="1" value={form.bpm} onChange={set('bpm')} /></div>
        <div className="space-y-1 sm:col-span-2"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={set('description')} /></div>
        <div className="space-y-1"><Label>Tags (comma separated)</Label><Input value={form.tags} onChange={set('tags')} placeholder="lofi, chill" /></div>
        <div className="space-y-1">
          <Label className="flex items-center gap-1.5">License <InfoTip text={TIPS.license} /></Label>
          <select value={form.license} onChange={set('license')} className="w-full h-9 rounded-md border border-input bg-popover px-3 text-sm">
            {LICENSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <label className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 text-sm"><span className="flex items-center gap-1.5">Allow others to copy / remix <InfoTip text={TIPS.copyAllowed} /></span><Switch checked={form.copyAllowed} onCheckedChange={set('copyAllowed')} /></label>
        <label className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 text-sm"><span className="flex items-center gap-1.5">Allow download <InfoTip text={TIPS.downloadAllowed} /></span><Switch checked={form.downloadAllowed} onCheckedChange={set('downloadAllowed')} /></label>
      </div>
      <Button className="merc-button" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save properties
      </Button>
    </section>
  );
}