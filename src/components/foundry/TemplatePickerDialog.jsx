import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import TemplateCard from './TemplateCard';
import useFoundryTemplates from '@/hooks/useFoundryTemplates';
import { forkPlugin } from '@/lib/foundry/forkPlugin';

// "Start from a template" — picks a curated patch and forks it as the new patch,
// instead of opening on a blank rack.
export default function TemplatePickerDialog({ open, onOpenChange }) {
  const templates = useFoundryTemplates();
  const [forking, setForking] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const use = async (template) => {
    setForking(true);
    try {
      const created = await forkPlugin(template, { titlePrefix: 'My ', titleSuffix: '' });
      onOpenChange(false);
      navigate(`/foundry/${created.id}`);
    } catch (e) {
      toast({ title: 'Could not start from template', description: e.message, variant: 'destructive' });
    } finally {
      setForking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Start from a template</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-white/45 -mt-2 mb-2">
          Your copy is private and fully editable — the original stays untouched.
        </p>

        {templates === null && (
          <div className="flex items-center gap-2 text-xs text-white/40 py-10">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading templates…
          </div>
        )}
        {templates && !templates.length && (
          <p className="text-xs text-white/40 py-10">No starter templates are published yet.</p>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          {(templates || []).map((t) => (
            <TemplateCard key={t.id} template={t} onFork={use} forking={forking} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}