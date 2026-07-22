import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Folder, FolderPlus, ChevronDown, Pencil, Trash2, Check, X, Layers } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

/**
 * Workspace switcher — select, create, rename and delete workspaces.
 * "All Assets" (id 'all') is the built-in default view.
 */
export default function WorkspaceSwitcher({ userId, workspaces, activeId, onSelect, onWorkspacesChange }) {
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [busy, setBusy] = useState(false);

  const active = workspaces.find(w => w.id === activeId);

  const handleCreate = async () => {
    const name = nameInput.trim();
    if (!name) return;
    setBusy(true);
    const created = await base44.entities.Workspace.create({ user_id: userId, name });
    onWorkspacesChange([created, ...workspaces]);
    onSelect(created.id);
    toast.success(`Workspace "${name}" created`);
    setNameInput(''); setCreating(false); setBusy(false);
  };

  const handleRename = async (id) => {
    const name = nameInput.trim();
    if (!name) return;
    setBusy(true);
    await base44.entities.Workspace.update(id, { name });
    onWorkspacesChange(workspaces.map(w => w.id === id ? { ...w, name } : w));
    toast.success('Workspace renamed');
    setNameInput(''); setRenamingId(null); setBusy(false);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete workspace "${name}"? Assets in it are kept and move back to All Assets.`)) return;
    await base44.entities.Workspace.delete(id);
    onWorkspacesChange(workspaces.filter(w => w.id !== id));
    if (activeId === id) onSelect('all');
    toast.success('Workspace deleted');
  };

  const inlineInput = (onConfirm) => (
    <div className="flex items-center gap-1 px-2 py-1.5" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      <Input autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onConfirm(); if (e.key === 'Escape') { setCreating(false); setRenamingId(null); setNameInput(''); } }}
        placeholder="Workspace name…" className="h-7 text-xs rounded-lg" />
      <Button size="icon" variant="ghost" disabled={busy} className="h-7 w-7 rounded-lg text-emerald-400" onClick={onConfirm}>
        <Check className="w-3.5 h-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg"
        onClick={() => { setCreating(false); setRenamingId(null); setNameInput(''); }}>
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-lg gap-1.5 text-xs font-mono uppercase tracking-wider"
          title="Switch between workspaces to organize your library">
          <Layers className="w-3.5 h-3.5 text-[#FF9A4D]" />
          {active ? active.name : 'All Assets'}
          <ChevronDown className="w-3 h-3 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs">Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onSelect('all')} className="text-xs gap-2 cursor-pointer">
          <Folder className="w-3.5 h-3.5" />
          <span className="flex-1">All Assets</span>
          {activeId === 'all' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
        </DropdownMenuItem>
        {workspaces.map(w => (
          renamingId === w.id
            ? <div key={w.id}>{inlineInput(() => handleRename(w.id))}</div>
            : (
              <DropdownMenuItem key={w.id} onClick={() => onSelect(w.id)} className="text-xs gap-2 cursor-pointer group">
                <Folder className="w-3.5 h-3.5" />
                <span className="flex-1 truncate">{w.name}</span>
                {activeId === w.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                <button title="Rename" className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={e => { e.stopPropagation(); setRenamingId(w.id); setNameInput(w.name); setCreating(false); }}>
                  <Pencil className="w-3 h-3" />
                </button>
                <button title="Delete" className="opacity-0 group-hover:opacity-100 p-0.5 text-destructive"
                  onClick={e => { e.stopPropagation(); handleDelete(w.id, w.name); }}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </DropdownMenuItem>
            )
        ))}
        <DropdownMenuSeparator />
        {creating
          ? inlineInput(handleCreate)
          : (
            <DropdownMenuItem className="text-xs gap-2 cursor-pointer text-[#FFC98A]"
              onSelect={e => { e.preventDefault(); setCreating(true); setRenamingId(null); setNameInput(''); }}>
              <FolderPlus className="w-3.5 h-3.5" /> New workspace
            </DropdownMenuItem>
          )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}