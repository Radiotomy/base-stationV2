import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export default function ChatModerationPanel({ session, open, onOpenChange }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !session?.id) return;
    setLoading(true);
    base44.entities.LiveChatMessage.filter({ session_id: session.id }, '-created_date', 200)
      .then(setMessages)
      .catch(() => toast.error('Failed to load chat'))
      .finally(() => setLoading(false));
  }, [open, session?.id]);

  const deleteMessage = async (id) => {
    try {
      await base44.entities.LiveChatMessage.delete(id);
      setMessages(prev => prev.filter(m => m.id !== id));
      toast.success('Message removed');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const clearAll = async () => {
    try {
      await base44.entities.LiveChatMessage.deleteMany({ session_id: session.id });
      setMessages([]);
      toast.success('Chat history cleared');
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Chat Moderation — {session?.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No chat messages in this session.</p>
          ) : (
            <>
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {messages.map(m => (
                  <div key={m.id} className="flex items-start gap-2 bg-muted/40 rounded-xl px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground">{m.user_name || m.userName || 'Anonymous'}</p>
                      <p className="text-sm text-muted-foreground break-words">{m.emoji || m.message}</p>
                    </div>
                    <button onClick={() => deleteMessage(m.id)} className="text-muted-foreground hover:text-destructive shrink-0 p-1" title="Delete message">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <Button variant="destructive" size="sm" onClick={clearAll} className="w-full rounded-xl gap-2">
                <Trash2 className="w-3.5 h-3.5" /> Clear Entire Chat History
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}