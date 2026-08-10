import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { UserPlus, Link2, X, Loader2, AudioLines } from 'lucide-react';

const ROLES = [
  { id: 'guest', label: 'Guest' },
  { id: 'co_host', label: 'Co-host' },
  { id: 'editor', label: 'Editor' },
];

export default function CollaboratorPanel({ podcastId }) {
  const { toast } = useToast();
  const [collabs, setCollabs] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('guest');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await base44.functions.invoke('orvoCollaboration', { action: 'list', podcast_id: podcastId });
    setCollabs(res.data?.collaborations || []);
    setRecordings(res.data?.recordings || []);
  };

  useEffect(() => { load(); }, [podcastId]); // eslint-disable-line react-hooks/exhaustive-deps

  const invite = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const res = await base44.functions.invoke('orvoCollaboration', {
      action: 'invite', podcast_id: podcastId, collaborator_email: email, role,
    });
    setBusy(false);
    if (res.data?.error) return toast({ title: 'Invite failed', description: res.data.error, variant: 'destructive' });
    setEmail('');
    toast({ title: 'Invite created', description: 'Copy the guest link and send it over.' });
    load();
  };

  const revoke = async (id) => {
    await base44.functions.invoke('orvoCollaboration', { action: 'revoke', podcast_id: podcastId, collaboration_id: id });
    load();
  };

  const copyLink = (token) => {
    navigator.clipboard.writeText(`${window.location.origin}/studios/orvo/guest/${token}`);
    toast({ title: 'Guest link copied' });
  };

  return (
    <div className="merc-card rounded-2xl p-5 mb-8">
      <p className="text-xs font-bold uppercase tracking-widest text-[#FF9A4D] mb-3 flex items-center gap-2">
        <UserPlus className="w-3.5 h-3.5" /> Collaborators
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="guest@email.com"
          className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
        >
          {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <button onClick={invite} disabled={busy} className="merc-button rounded-lg px-4 py-2 text-sm font-black flex items-center gap-1.5 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Invite
        </button>
      </div>

      {collabs.length === 0 ? (
        <p className="text-xs text-white/35">No collaborators yet — invite a guest to record their side remotely.</p>
      ) : (
        <div className="space-y-2">
          {collabs.map((c) => (
            <div key={c.id} className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{c.collaborator_email}</p>
                <p className="text-[11px] text-white/40 capitalize">{c.role.replace('_', ' ')} · {c.status}</p>
              </div>
              {c.status !== 'revoked' && (
                <>
                  <button onClick={() => copyLink(c.guest_link_token)} className="text-white/50 hover:text-[#FF9A4D]" title="Copy guest link">
                    <Link2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => revoke(c.id)} className="text-white/50 hover:text-red-400" title="Revoke">
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {recordings.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2 flex items-center gap-2">
            <AudioLines className="w-3.5 h-3.5" /> Guest takes
          </p>
          <div className="space-y-3">
            {recordings.map((r) => (
              <div key={r.id} className="bg-black/20 rounded-lg px-3 py-2">
                <p className="text-sm text-white truncate">{r.title}</p>
                {r.notes && <p className="text-[11px] text-white/40 mb-1.5">{r.notes}</p>}
                <audio src={r.audio_url} controls className="w-full h-8" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}