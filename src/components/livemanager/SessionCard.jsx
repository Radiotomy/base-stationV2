import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Radio, Pencil, MessageSquare, Archive, Trash2, BarChart3, Users, Clock, Globe, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import SessionEditDialog from './SessionEditDialog';
import ChatModerationPanel from './ChatModerationPanel';

const STATUS_STYLES = {
  streaming: 'bg-red-500/20 text-red-400',
  draft: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-green-500/20 text-green-400',
  archived: 'bg-muted text-muted-foreground',
};

export default function SessionCard({ session, onChanged }) {
  const [editOpen, setEditOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isActive = session.status === 'streaming' || session.status === 'draft';

  const formatDuration = (s) => {
    if (!s) return '—';
    const m = Math.floor(s / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  };

  const archive = async () => {
    try {
      await base44.entities.LiveSession.update(session.id, { status: 'archived' });
      toast.success('Session archived');
      onChanged();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async () => {
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); return; }
    try {
      await base44.entities.LiveChatMessage.deleteMany({ session_id: session.id });
      await base44.entities.LiveSession.delete(session.id);
      toast.success('Session deleted');
      onChanged();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-black text-foreground truncate">{session.title}</h3>
          {session.description && <p className="text-xs text-muted-foreground truncate">{session.description}</p>}
        </div>
        <Badge className={`${STATUS_STYLES[session.status] || STATUS_STYLES.archived} border-0 shrink-0 capitalize`}>
          {session.status === 'streaming' ? '🔴 Live' : session.status}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {session.peak_viewers || 0} peak</span>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDuration(session.duration_seconds)}</span>
        {session.visual_layer === 'portals' && <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> 3D Venue</span>}
        {session.start_time && <span>{new Date(session.start_time).toLocaleDateString()}</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {isActive && (
          <Button asChild size="sm" className="rounded-xl gap-1.5 bg-red-600 hover:bg-red-500 font-bold">
            <Link to={`/live-studio?roomId=${session.id}`}><Radio className="w-3.5 h-3.5" /> {session.status === 'streaming' ? 'Resume Live' : 'Open Draft'}</Link>
          </Button>
        )}
        {session.status === 'completed' && (
          <Button asChild size="sm" variant="secondary" className="rounded-xl gap-1.5">
            <Link to={`/live-summary?sessionId=${session.id}`}><BarChart3 className="w-3.5 h-3.5" /> Summary</Link>
          </Button>
        )}
        {session.status === 'streaming' && (
          <Button asChild size="sm" variant="secondary" className="rounded-xl gap-1.5">
            <Link to={`/live-watch?roomId=${session.id}`}><ExternalLink className="w-3.5 h-3.5" /> Fan View</Link>
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} className="rounded-xl gap-1.5">
          <Pencil className="w-3.5 h-3.5" /> Edit
        </Button>
        <Button size="sm" variant="outline" onClick={() => setChatOpen(true)} className="rounded-xl gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" /> Moderate Chat
        </Button>
        {session.status === 'completed' && (
          <Button size="sm" variant="ghost" onClick={archive} className="rounded-xl gap-1.5 text-muted-foreground">
            <Archive className="w-3.5 h-3.5" /> Archive
          </Button>
        )}
        {!isActive && (
          <Button size="sm" variant="ghost" onClick={remove} className={`rounded-xl gap-1.5 ${confirmDelete ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
            <Trash2 className="w-3.5 h-3.5" /> {confirmDelete ? 'Confirm Delete?' : 'Delete'}
          </Button>
        )}
      </div>

      {editOpen && <SessionEditDialog session={session} open={editOpen} onOpenChange={setEditOpen} onSaved={onChanged} />}
      {chatOpen && <ChatModerationPanel session={session} open={chatOpen} onOpenChange={setChatOpen} />}
    </div>
  );
}