import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Synced multi-stem playback for the Stem Deck.
 *
 * One AudioContext with one buffer source per stem, all started at the same
 * instant — that is what makes six stems a deck rather than six players. The
 * clock is derived from ctx.currentTime rather than stored, so a lane change
 * can never nudge playback out of alignment.
 *
 * Mixer moves are applied to the live gain/pan nodes, so nothing restarts when
 * you mute, solo or ride a fader.
 */
export default function useStemDeck(stems) {
  const [mix, setMix] = useState({});
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  const ctxRef = useRef(null);
  const buffersRef = useRef({});
  const nodesRef = useRef({});
  const startedAt = useRef(0);
  const startOffset = useRef(0);
  const raf = useRef(null);
  const mixRef = useRef({});

  mixRef.current = mix;

  // Reset whenever a new set of stems arrives
  useEffect(() => {
    setMix(Object.fromEntries((stems || []).map(s => [s.id, { volume: 80, pan: 0, muted: false, solo: false }])));
    setReady(false);
    setPlaying(false);
    setPosition(0);
    setDuration(0);
    buffersRef.current = {};
  }, [stems]);

  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    ctxRef.current?.close();
  }, []);

  const gainFor = useCallback((id) => {
    const m = mixRef.current;
    const s = m[id];
    if (!s) return 0;
    const anySolo = Object.values(m).some(v => v.solo);
    if (s.muted || (anySolo && !s.solo)) return 0;
    return Math.max(0, Math.min(1, s.volume / 100));
  }, []);

  const load = useCallback(async () => {
    if (ready || loading) return true;
    setLoading(true);
    setError(null);
    try {
      const ctx = ctxRef.current || new AudioContext();
      ctxRef.current = ctx;
      const decoded = await Promise.all((stems || []).map(async (s) => {
        const res = await fetch(s.file_url);
        return [s.id, await ctx.decodeAudioData(await res.arrayBuffer())];
      }));
      buffersRef.current = Object.fromEntries(decoded);
      setDuration(Math.max(...decoded.map(([, b]) => b.duration)));
      setReady(true);
      return true;
    } catch (e) {
      setError('Could not load these stems for playback.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [stems, ready, loading]);

  const stopSources = () => {
    Object.values(nodesRef.current).forEach(({ source }) => { try { source.stop(); } catch { /* already stopped */ } });
    nodesRef.current = {};
  };

  const tick = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const t = startOffset.current + (ctx.currentTime - startedAt.current);
    if (t >= duration) {
      stopSources();
      setPlaying(false);
      setPosition(0);
      startOffset.current = 0;
      return;
    }
    setPosition(t);
    raf.current = requestAnimationFrame(tick);
  }, [duration]);

  const startAt = useCallback((offset) => {
    const ctx = ctxRef.current;
    stopSources();
    Object.entries(buffersRef.current).forEach(([id, buffer]) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = gainFor(id);
      const panner = ctx.createStereoPanner();
      panner.pan.value = (mixRef.current[id]?.pan || 0) / 100;
      source.connect(gain).connect(panner).connect(ctx.destination);
      source.start(0, Math.min(offset, buffer.duration));
      nodesRef.current[id] = { source, gain, panner };
    });
    startedAt.current = ctx.currentTime;
    startOffset.current = offset;
    setPlaying(true);
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
  }, [gainFor, tick]);

  const play = useCallback(async () => {
    if (!(await load())) return;
    await ctxRef.current.resume();
    startAt(position >= duration ? 0 : position);
  }, [load, startAt, position, duration]);

  const pause = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stopSources();
    setPlaying(false);
  }, []);

  const seek = useCallback((t) => {
    const clamped = Math.max(0, Math.min(t, duration));
    setPosition(clamped);
    if (playing) startAt(clamped);
    else startOffset.current = clamped;
  }, [duration, playing, startAt]);

  const setLane = useCallback((id, patch) => {
    setMix((prev) => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } };
      mixRef.current = next;
      // Live-apply so playback never restarts on a mixer move
      Object.entries(nodesRef.current).forEach(([nid, n]) => {
        n.gain.gain.value = gainFor(nid);
        n.panner.pan.value = (next[nid]?.pan || 0) / 100;
      });
      return next;
    });
  }, [gainFor]);

  return { mix, setLane, play, pause, seek, playing, position, duration, loading, ready, error };
}