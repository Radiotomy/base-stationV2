import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NPC_ANIMATIONS } from '@/lib/live/venueStaffRoles';

/** One staff character's settings. Editing is local — the parent saves. */
export default function VenueStaffRow({ role, member, onChange }) {
  const set = (patch) => onChange({ ...member, ...patch });

  return (
    <div className="rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">{role.label}</p>
          <p className="text-xs text-muted-foreground">{role.hint}</p>
        </div>
        <Switch checked={member.enabled !== false} onCheckedChange={(v) => set({ enabled: v })} />
      </div>

      {member.enabled !== false && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              value={member.name || ''}
              onChange={(e) => set({ name: e.target.value })}
              placeholder={`Name (e.g. ${role.label})`}
              className="rounded-xl h-10 text-sm"
            />
            <Select value={member.animation ?? role.defaultAnimation} onValueChange={(v) => set({ animation: v })}>
              <SelectTrigger className="rounded-xl h-10 text-sm"><SelectValue placeholder="Animation" /></SelectTrigger>
              <SelectContent>
                {NPC_ANIMATIONS.map((a) => (
                  <SelectItem key={a.value || 'idle'} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Input
            value={member.glb_url || ''}
            onChange={(e) => set({ glb_url: e.target.value })}
            placeholder="https://… rigged GLB avatar URL"
            className="rounded-xl h-10 text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={member.rigged === false} onCheckedChange={(v) => set({ rigged: !v })} />
            This model is not rigged (it will stand still — animations need a skeleton)
          </label>

          <Textarea
            value={member.persona || ''}
            onChange={(e) => set({ persona: e.target.value })}
            placeholder="Character notes — how they talk, their attitude, anything they should mention."
            className="rounded-xl text-sm min-h-[70px]"
          />
        </div>
      )}
    </div>
  );
}