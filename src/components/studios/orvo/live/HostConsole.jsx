import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Mic } from 'lucide-react';

/** Host-only controls: go live / end, and drive the AI co-host. */
export default function HostConsole({ event, onStatusChange }) {
  const { toast } = useToast();
  const [brief, setBrief] = useState('');
  const [verbatim, setVerbatim] = useState(false);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const setStatus = async (action) => {
    setBusy(true);
    try {
      const { data } = await base44.functions.invoke('orvoLiveEvent', { event_id: event.id, action });
      onStatusChange?.(data.event);
    } catch (e) {
      toast({ title: 'Action failed', description: e.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  const sendTurn = async () => {
    if (!brief.trim()) return;
    setSpeaking(true);
    try {
      await base44.functions.invoke('orvoLiveTurn', {
        event_id: event.id,
        brief: brief.trim(),
        speak_verbatim: verbatim,
      });
      setBrief('');
    } catch (e) {
      toast({ title: 'Co-host failed', description: e.message, variant: 'destructive' });
    }
    setSpeaking(false);
  };

  return (
    <div className="merc-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-[#FF9A4D]">Host console</p>
        {event.status === 'live' ? (
          <button onClick={() => setStatus('end')} disabled={busy} className="merc-button-dark rounded-full px-4 py-1.5 text-xs font-black disabled:opacity-50">End session</button>
        ) : event.status === 'scheduled' ? (
          <button onClick={() => setStatus('start')} disabled={busy} className="merc-button rounded-full px-4 py-1.5 text-xs font-black disabled:opacity-50">Go live</button>
        ) : null}
      </div>

      {event.status === 'live' && event.is_ai_hosted && (
        <div className="space-y-2">
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Tell the co-host what to cover next…"
            rows={3}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF9A4D]/60"
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-white/50">
              <input type="checkbox" checked={verbatim} onChange={(e) => setVerbatim(e.target.checked)} />
              Read my words exactly
            </label>
            <button onClick={sendTurn} disabled={speaking || !brief.trim()} className="merc-button rounded-full px-5 py-2 text-sm font-black disabled:opacity-50 flex items-center gap-2">
              {speaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
              {speaking ? 'Speaking…' : 'Send to air'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}