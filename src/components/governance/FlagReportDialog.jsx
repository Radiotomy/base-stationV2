import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Flag } from 'lucide-react';
import { FLAG_PLATFORMS } from '@/components/governance/governanceSignals';

export default function FlagReportDialog({ user, onCreated }) {
  const [open, setOpen] = useState(false);
  const [trackTitle, setTrackTitle] = useState('');
  const [platform, setPlatform] = useState('');
  const [cosScore, setCosScore] = useState('');
  const [hadManifest, setHadManifest] = useState(true);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = trackTitle.trim() && platform;

  const submit = async () => {
    setSaving(true);
    await base44.entities.TransparencyFlag.create({
      user_id: user.id,
      user_name: user.full_name,
      track_title: trackTitle.trim(),
      platform,
      cos_score: cosScore === '' ? undefined : Number(cosScore),
      had_manifest: hadManifest,
      description: description.trim(),
      status: 'reported',
    });
    setSaving(false);
    setOpen(false);
    setTrackTitle(''); setPlatform(''); setCosScore(''); setDescription(''); setHadManifest(true);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl font-bold gap-2 merc-button"><Flag className="w-4 h-4" /> Report a False Flag</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report a downstream false flag</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)} placeholder="Track title" />
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger><SelectValue placeholder="Which platform flagged it?" /></SelectTrigger>
            <SelectContent>
              {FLAG_PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" min="0" max="100" value={cosScore}
            onChange={(e) => setCosScore(e.target.value)} placeholder="Track's COS score at time of flag (optional)" />
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={hadManifest} onCheckedChange={(v) => setHadManifest(!!v)} />
            A Provenance Manifest / DDEX bundle was submitted with the release
          </label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
            placeholder="What happened? Flag reason given, appeal outcome, human-input evidence available…" />
          <Button disabled={!canSubmit || saving} onClick={submit} className="w-full rounded-xl font-bold merc-button">
            {saving ? 'Submitting…' : 'Add to the Transparency Registry'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}