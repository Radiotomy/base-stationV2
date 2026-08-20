import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, GraduationCap } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import TemplateCard from './TemplateCard';
import useFoundryTemplates from '@/hooks/useFoundryTemplates';
import { forkPlugin } from '@/lib/foundry/forkPlugin';

// Curated reference patches, above the community shelf. Deliberately hidden when
// nothing is curated yet — an empty "learn from these" rail teaches nothing.
export default function StarterTemplatesShelf() {
  const templates = useFoundryTemplates();
  const [forking, setForking] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const use = async (template) => {
    setForking(true);
    try {
      const created = await forkPlugin(template, { titlePrefix: 'My ', titleSuffix: '' });
      navigate(`/foundry/${created.id}`);
    } catch (e) {
      toast({ title: 'Could not start from template', description: e.message, variant: 'destructive' });
    } finally {
      setForking(false);
    }
  };

  if (templates === null) {
    return (
      <div className="flex items-center gap-2 text-xs text-white/40 py-8">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading starter templates…
      </div>
    );
  }
  if (!templates.length) return null;

  return (
    <div className="mb-10">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <GraduationCap className="w-3.5 h-3.5 text-[#FF9A4D]" />
        <span className="text-[11px] uppercase tracking-widest text-white/50">Starter templates</span>
        <span className="px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest text-[#FFC98A] border border-white/12 bg-white/5">
          Curated reference
        </span>
      </div>
      <p className="text-[11px] text-white/40 mb-3 max-w-xl leading-relaxed">
        Canonical patches you can hear, open and read module by module. Open one to trace
        how it's wired, or use it as the starting point for your own.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {templates.map((t) => (
          <TemplateCard key={t.id} template={t} onFork={use} forking={forking} />
        ))}
      </div>
    </div>
  );
}