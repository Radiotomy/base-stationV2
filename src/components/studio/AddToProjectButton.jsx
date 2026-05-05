import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, FolderPlus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

/**
 * Phase 3 — "Add to Project" button used inside every studio tool.
 * Appends a workflow step to the project's `workflow.steps` array.
 *
 * Props:
 *   - asset: the UserAsset to add
 *   - tool: tool key (e.g. 'mastering_studio')
 *   - toolRoute: route for re-opening (e.g. '/mastering-studio')
 *   - label: optional human-readable step label
 */
export default function AddToProjectButton({ asset, tool, toolRoute, label }) {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    base44.auth.me().then(u =>
      base44.entities.Project.filter({ user_id: u.id }, '-updated_date', 30)
        .then(setProjects).catch(() => {})
    ).catch(() => {});
  }, []);

  const addToProject = async (project) => {
    if (!asset?.id) return;
    const step = {
      type: tool,
      asset_id: asset.id,
      tool_route: toolRoute,
      label: label || `${tool.replace(/_/g, ' ')} — ${asset.title}`,
      createdAt: new Date().toISOString(),
    };
    const existing = project.workflow?.steps || [];
    await base44.entities.Project.update(project.id, {
      workflow: { steps: [...existing, step] },
    });
    toast.success(`Added to "${project.title}"`, { icon: <Check className="w-4 h-4" /> });
  };

  const createNew = async () => {
    if (!asset?.id) return;
    const user = await base44.auth.me();
    const proj = await base44.entities.Project.create({
      user_id: user.id,
      user_email: user.email,
      title: asset.title || 'New Project',
      status: 'in_progress',
      workflow: { steps: [{
        type: tool,
        asset_id: asset.id,
        tool_route: toolRoute,
        label: label || `${tool.replace(/_/g, ' ')} — ${asset.title}`,
        createdAt: new Date().toISOString(),
      }]},
    });
    toast.success(`Created project "${proj.title}"`);
    setProjects(p => [proj, ...p]);
  };

  if (!asset?.id) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-lg gap-1.5 text-xs">
          <FolderPlus className="w-3.5 h-3.5" /> Add to Project
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs">Your Projects</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={createNew} className="text-xs gap-2 cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> New Project
        </DropdownMenuItem>
        {projects.length > 0 && <DropdownMenuSeparator />}
        {projects.map(p => (
          <DropdownMenuItem key={p.id} onClick={() => addToProject(p)} className="text-xs cursor-pointer">
            <span className="truncate">{p.title}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}