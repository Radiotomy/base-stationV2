import { useEffect, useState } from 'react';
import { Loader2, Plus, ChevronDown, FilePlus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getTemplateProject } from '@/lib/audiotool/nexusClient';

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
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onSelect={() => onCreate(null)}>
          <FilePlus className="w-4 h-4 mr-2" /> Create Blank Project
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!template} onSelect={() => onCreate(template)}>
          <Sparkles className="w-4 h-4 mr-2" />
          <div>
            <p>Start from Songstarter Template</p>
            <p className="text-[11px] text-muted-foreground">
              {template ? 'Mixer, Machiniste drums & an audio track ready for loops' : 'Template not set up yet'}
            </p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}