import React, { useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

// Admin-only curation strip: promote one of your own patches to a Starter Template
// and attach an optional audition clip. Templates are live rows, so curating one
// needs no deploy.
export default function TemplateCurationControls({ plugin, onChange }) {
  const [saving, setSaving] = useState(false);
  const [url, setUrl] = useState(plugin.audition_url || '');
  const { toast } = useToast();

  const commit = async (patch) => {
    if (patch.audition_url && !patch.audition_url.startsWith('https://')) {
      toast({ title: 'Audition clip must be an https URL', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.FoundryPlugin.update(plugin.id, patch);
      onChange(patch);
      toast({ title: 'Template settings saved' });
    } catch (e) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2 flex-wrap"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <BookOpen className="w-3.5 h-3.5 text-[#FFC98A]" />
      <span className="text-[10px] uppercase tracking-widest text-white/45 mr-1">Curation</span>

      <Button
        size="sm"
        variant="outline"
        disabled={saving}
        onClick={() => commit({ is_template: !plugin.is_template, is_public: true })}
        className={`h-7 px-3 text-[11px] border-white/12 ${plugin.is_template ? 'text-[#FFC98A]' : 'text-white/60'}`}
      >
        {saving ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : null}
        {plugin.is_template ? 'Starter template' : 'Mark as template'}
      </Button>

      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://… audition clip (optional)"
        className="h-7 flex-1 min-w-[200px] text-[11px] bg-white/5 border-white/10"
      />
      <Button
        size="sm"
        variant="ghost"
        disabled={saving || url === (plugin.audition_url || '')}
        onClick={() => commit({ audition_url: url })}
        className="h-7 px-2 text-[11px] text-white/60"
      >
        Save clip
      </Button>
    </div>
  );
}