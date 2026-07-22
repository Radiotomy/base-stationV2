import { FolderInput, Folder, Check } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

/**
 * Small menu on an asset card to move it into a workspace.
 */
export default function WorkspaceAssignMenu({ asset, workspaces, onAssign }) {
  if (!workspaces || workspaces.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button title="Move to workspace"
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <FolderInput className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs">Move to workspace</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onAssign(asset.id, '')} className="text-xs gap-2 cursor-pointer">
          <Folder className="w-3.5 h-3.5" />
          <span className="flex-1">No workspace</span>
          {!asset.workspace_id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
        </DropdownMenuItem>
        {workspaces.map(w => (
          <DropdownMenuItem key={w.id} onClick={() => onAssign(asset.id, w.id)} className="text-xs gap-2 cursor-pointer">
            <Folder className="w-3.5 h-3.5" />
            <span className="flex-1 truncate">{w.name}</span>
            {asset.workspace_id === w.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}