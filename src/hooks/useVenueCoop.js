import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { parseCommand, venueChatId } from '@/lib/venue/coopCommands';
import { runCoopCommand } from '@/lib/audiotool/runCoopCommand';

const COOLDOWN_MS = 60_000;
const MAX_QUEUE = 5;

/**
 * Host side of the audience co-op: listens to the venue chat over the realtime
 * socket, validates /generate commands and runs them one at a time in the live
 * session. A Web Lock makes sure only one open Bridge tab processes commands.
 */
export default function useVenueCoop({ enabled, venueId, session }) {
  const [status, setStatus] = useState('off'); // off | listening | blocked
  const [log, setLog] = useState([]);
  const cfg = useRef(session);
  cfg.current = session;

  useEffect(() => {
    if (!enabled || !venueId) { setStatus('off'); return; }
    const chatId = venueChatId(venueId);
    const lastBy = new Map();
    const queue = [];
    let busy = false;
    let unsub = () => {};
    let release = () => {};
    let host = null;

    const say = (message) => base44.entities.LiveChatMessage.create({
      session_id: chatId, user_id: host.id, user_name: 'Audiotool Bridge', message, type: 'system',
    }).catch(() => {});
    const upsert = (id, patch) => setLog((l) => l.map((e) => (e.id === id ? { ...e, ...patch } : e)));

    const drain = async () => {
      if (busy || !queue.length) return;
      busy = true;
      const cmd = queue.shift();
      upsert(cmd.id, { status: 'generating' });
      say(`🎛 Generating ${cmd.kind} "${cmd.prompt}" for ${cmd.user}…`);
      try {
        const { bar } = await runCoopCommand(cfg.current, cmd);
        upsert(cmd.id, { status: 'inserted', bar });
        say(`✅ ${cmd.user}'s ${cmd.kind} is in the session at bar ${bar}.`);
        cfg.current.onChanged?.();
      } catch (e) {
        upsert(cmd.id, { status: 'failed', error: e.message });
        say(`⚠️ Couldn't generate ${cmd.user}'s ${cmd.kind}.`);
      }
      busy = false;
      drain();
    };

    const onMessage = ({ type, data }) => {
      if (type !== 'create' || data?.session_id !== chatId || data.type === 'system') return;
      const parsed = parseCommand(data.message);
      if (!parsed) return;
      const user = data.user_name || 'Listener';
      if (parsed.error) return say(`${user}: ${parsed.error}`);
      if (!cfg.current.allow[parsed.kind]) return say(`${user}: the host has ${parsed.kind} commands switched off.`);
      if (Date.now() - (lastBy.get(data.user_id) || 0) < COOLDOWN_MS) return say(`${user}: one request per minute, please.`);
      if (queue.length >= MAX_QUEUE) return say(`${user}: the queue is full — try again shortly.`);
      lastBy.set(data.user_id, Date.now());
      const cmd = { id: data.id, user, ...parsed, status: 'queued', at: new Date().toISOString() };
      queue.push(cmd);
      setLog((l) => [cmd, ...l].slice(0, 30));
      drain();
    };

    let cancelled = false;
    navigator.locks.request(`venue-coop-${venueId}`, { ifAvailable: true }, async (lock) => {
      if (cancelled) return;
      if (!lock) { setStatus('blocked'); return; }
      host = await base44.auth.me();
      unsub = base44.entities.LiveChatMessage.subscribe(onMessage);
      setStatus('listening');
      say('🎚 Audience co-op is open — type /generate sfx, loop or midi followed by your idea.');
      await new Promise((r) => { release = r; });
    });

    return () => { cancelled = true; unsub(); release(); };
  }, [enabled, venueId]);

  return { status, log };
}