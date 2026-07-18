import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { COS_SIGNALS } from '@/components/governance/governanceSignals';

export default function NewProposalDialog({ user, onCreated }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [signalKey, setSignalKey] = useState('');
  const [proposedWeight, setProposedWeight] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const currentWeight = COS_SIGNALS.find((s) => s.key === signalKey)?.weight ?? 0;
  const canSubmit = title.trim() && signalKey && proposedWeight !== '';

  const submit = async () => {
    setSaving(true);
    await base44.entities.CosProposal.create({
      user_id: user.id,
      user_name: user.full_name,
      title: title.trim(),
      signal_key: signalKey,
      current_weight: currentWeight,
      proposed_weight: Number(proposedWeight),
      description: description.trim(),
      status: 'open',
    });
    setSaving(false);
    setOpen(false);
    setTitle(''); setSignalKey(''); setProposedWeight(''); setDescription('');
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl font-bold gap-2 merc-button"><Plus className="w-4 h-4" /> New Proposal</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Propose a COS weight change</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder='e.g. "Custom-trained local vocal models deserve +20"' />
          <Select value={signalKey} onValueChange={setSignalKey}>
            <SelectTrigger><SelectValue placeholder="Which scoring signal?" /></SelectTrigger>
            <SelectContent>
              {COS_SIGNALS.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}{s.key !== 'new_signal' ? ` (currently +${s.weight})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="number" min="0" max="100" value={proposedWeight}
            onChange={(e) => setProposedWeight(e.target.value)} placeholder="Proposed point value (0–100)" />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
            placeholder="Rationale — why should the community adopt this baseline? Reference new tools, licensing models, or workflows." />
          <Button disabled={!canSubmit || saving} onClick={submit} className="w-full rounded-xl font-bold merc-button">
            {saving ? 'Submitting…' : 'Submit to the Community Ledger'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}