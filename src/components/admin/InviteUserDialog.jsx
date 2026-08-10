import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [busy, setBusy] = useState(false);

  const invite = async () => {
    setBusy(true);
    try {
      await base44.users.inviteUser(email.trim(), role);
      toast.success(`Invite sent to ${email.trim()}`);
      setEmail('');
      setOpen(false);
    } catch (e) {
      toast.error(e?.message || 'Could not send the invite');
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-xl gap-2 text-xs">
          <UserPlus className="w-3.5 h-3.5" /> Invite user
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle>Invite a user</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com" className="rounded-xl"
          />
          <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit">
            {['user', 'admin'].map((r) => (
              <button
                key={r} onClick={() => setRole(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${role === r ? 'bg-purple-500/20 text-purple-300' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {r}
              </button>
            ))}
          </div>
          <Button onClick={invite} disabled={busy || !email.includes('@')} className="rounded-xl w-full">
            {busy ? 'Sending…' : 'Send invite'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}