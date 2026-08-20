import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Subscribe a fan-facing surface to a venue's on-air state.
 *
 * Polls rather than streams because the answer changes only when a track ends —
 * and it re-polls exactly when the current entry is due to finish, so the next
 * item appears on time without hammering the endpoint every few seconds during a
 * ten-minute video.
 */
export function useVenueNowPlaying({ venueId, roomId }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    if (!venueId && !roomId) { setLoading(false); return; }
    let cancelled = false;

    const load = async () => {
      try {
        const res = await base44.functions.invoke('getVenueNowPlaying', { venueId, roomId });
        if (cancelled) return;
        setState(res.data);
        setError('');
        // Re-check just after the current entry should end; never sooner than
        // 15s, and at least every 2 minutes so a schedule change is picked up.
        const remaining = res.data?.now_playing?.seconds_remaining;
        const delay = Math.min(120, Math.max(15, Number(remaining) + 2 || 60)) * 1000;
        timerRef.current = setTimeout(load, delay);
      } catch (err) {
        if (cancelled) return;
        setError(err?.response?.data?.error || 'Could not reach this venue');
        timerRef.current = setTimeout(load, 30000);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; if (timerRef.current) clearTimeout(timerRef.current); };
  }, [venueId, roomId]);

  return { state, loading, error };
}