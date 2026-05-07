import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Phase 5.7 — useSyncPlayback
 *
 * Drift-corrected fan-side playback for audio_mode="sync".
 * - On hydrate: seeks audio element to effective_position derived from
 *   nowPlaying.position_ms + (now - updated_at), and auto-plays if isPlaying.
 * - On event (play/pause/seek/track-change/restart): applies authoritative
 *   state to the audio element. Ignores events older than the last applied
 *   event timestamp to prevent regressions.
 * - Surfaces an `autoplayBlocked` flag so callers can show a "tap to play" toast.
 *
 * Returns:
 *   { autoplayBlocked, resume, applyEvent, hydrate }
 */
export function useSyncPlayback(audioRef, { enabled = true } = {}) {
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const lastEventTsRef = useRef(0);
  const lastTrackUrlRef = useRef('');

  const tryPlay = useCallback(async () => {
    const el = audioRef?.current;
    if (!el) return;
    try {
      await el.play();
      setAutoplayBlocked(false);
    } catch {
      setAutoplayBlocked(true);
    }
  }, [audioRef]);

  const resume = useCallback(() => {
    setAutoplayBlocked(false);
    return tryPlay();
  }, [tryPlay]);

  // Compute drift-corrected position (in seconds) from nowPlaying snapshot
  const effectivePositionSec = useCallback((np) => {
    if (!np) return 0;
    const posMs = Number(np.position_ms ?? np.position ?? 0);
    const updatedAt = np.updated_at ? new Date(np.updated_at).getTime() : Date.now();
    const isPlaying = !!np.isPlaying;
    const nowMs = Date.now();
    const ms = isPlaying ? posMs + (nowMs - updatedAt) : posMs;
    return Math.max(0, ms / 1000);
  }, []);

  // Hydrate from a nowPlaying snapshot (on mount or session swap)
  const hydrate = useCallback(async (nowPlaying) => {
    if (!enabled) return;
    const el = audioRef?.current;
    if (!el || !nowPlaying) return;

    const url = nowPlaying.track_url || nowPlaying.trackUrl;
    if (url && el.src !== url) {
      el.src = url;
      lastTrackUrlRef.current = url;
    }

    const seekTo = effectivePositionSec(nowPlaying);
    try { el.currentTime = seekTo; } catch {}

    if (nowPlaying.isPlaying) {
      await tryPlay();
    } else {
      el.pause();
    }
  }, [audioRef, effectivePositionSec, tryPlay, enabled]);

  // Apply an authoritative event from the event bus
  const applyEvent = useCallback(async (evt) => {
    if (!enabled || !evt) return;
    const el = audioRef?.current;
    if (!el) return;

    // Ignore stale events
    const ts = evt.timestamp ? new Date(evt.timestamp).getTime() : 0;
    if (ts && ts < lastEventTsRef.current) return;
    lastEventTsRef.current = ts || lastEventTsRef.current;

    const p = evt.payload || {};
    const url = p.track_url;
    const posSec = typeof p.position_ms === 'number' ? p.position_ms / 1000 : null;

    switch (evt.type) {
      case 'play': {
        if (url && el.src !== url) {
          el.src = url;
          lastTrackUrlRef.current = url;
        }
        if (posSec !== null) {
          // Drift-correct: add elapsed time since event timestamp
          const drift = ts ? (Date.now() - ts) / 1000 : 0;
          try { el.currentTime = Math.max(0, posSec + drift); } catch {}
        }
        await tryPlay();
        break;
      }
      case 'pause': {
        if (posSec !== null) {
          try { el.currentTime = posSec; } catch {}
        }
        el.pause();
        break;
      }
      case 'seek': {
        if (posSec !== null) {
          try { el.currentTime = posSec; } catch {}
        }
        if (!el.paused) await tryPlay();
        break;
      }
      case 'track-change': {
        if (url) {
          el.src = url;
          lastTrackUrlRef.current = url;
        }
        try { el.currentTime = 0; } catch {}
        if (p.isPlaying) {
          await tryPlay();
        } else {
          el.pause();
        }
        break;
      }
      case 'restart': {
        try { el.currentTime = 0; } catch {}
        await tryPlay();
        break;
      }
      case 'session-end': {
        el.pause();
        break;
      }
      default:
        break;
    }
  }, [audioRef, tryPlay, enabled]);

  // Resume audio context on any user interaction (clears autoplay-blocked state)
  useEffect(() => {
    if (!autoplayBlocked) return;
    const onInteract = () => { tryPlay(); };
    window.addEventListener('click', onInteract, { once: true });
    window.addEventListener('touchstart', onInteract, { once: true });
    return () => {
      window.removeEventListener('click', onInteract);
      window.removeEventListener('touchstart', onInteract);
    };
  }, [autoplayBlocked, tryPlay]);

  return { autoplayBlocked, resume, applyEvent, hydrate };
}