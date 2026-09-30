import { useEffect, useState } from 'react';
import { Loader2, Plus, ChevronDown, FilePlus, Sparkles, Disc3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { getTemplateProject } from '@/lib/audiotool/nexusClient';
import { VIBES } from '@/lib/audiotool/vibes';

/** onCreate(templateName, cover) — cover describes how the project cover is made. */
export default function CreateProjectMenu({ creating, disabled, onCreate }) {
  const [template, setTemplate] = useState(null);
  useEffect(() => { getTemplateProject().then(setTemplate); }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="merc-button" disabled={creating || disabled}>
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          New Project <ChevronDown className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem onSelect={() => onCreate(null, { source: 'blank_default' })}>
          <FilePlus className="w-4 h-4 mr-2" /> Create Blank Project
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!template} onSelect={() => onCreate(template, { source: 'template', vibe_label: 'Songstarter' })}>
          <Sparkles className="w-4 h-4 mr-2" />
          <div>
            <p>Start from Songstarter Template</p>
            <p className="text-[11px] text-muted-foreground">
              {template ? 'Mixer, Machiniste drums & an audio track ready for loops' : 'Template not set up yet'}
            </p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Start from a vibe</DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-1 p-1">
          {VIBES.map((v) => (
            <DropdownMenuItem key={v.id} className="rounded-lg border border-border text-xs"
              onSelect={() => onCreate(null, { source: 'vibe', vibe_label: v.label, prompt: v.loop, label: v.label })}>
              <Disc3 className="w-3.5 h-3.5 mr-1.5 text-accent" /> {v.label}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}