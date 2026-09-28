import { useEffect, useRef, useState } from 'react';

/** Plays arranged lanes in sync with live per-lane gain, mute and solo. */
export default function usePreStarterPlayer(lanes) {
  const ctxRef = useRef(null);
  const nodes = useRef({});
  const startedAt = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [mix, setMix] = useState({}); // key -> { volume, muted, solo }

  const state = (k) => mix[k] || { volume: 1, muted: false, solo: false };
  const anySolo = Object.values(mix).some((m) => m.solo);
  const gainOf = (k) => { const m = state(k); return m.muted || (anySolo && !m.solo) ? 0 : m.volume; };

  const stop = () => {
    Object.values(nodes.current).forEach((n) => { try { n.src.stop(); } catch { /* already stopped */ } });
    nodes.current = {};
    setPlaying(false);
  };

  const play = async () => {
    stop();
    const ready = lanes.filter((l) => l.buffer);
    if (!ready.length) return;
    const ctx = ctxRef.current || (ctxRef.current = new AudioContext());
    await ctx.resume();
    const t0 = ctx.currentTime + 0.05;
    ready.forEach((l) => {
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      src.buffer = l.buffer;
      g.gain.value = gainOf(l.key);
      src.connect(g).connect(ctx.destination);
      src.start(t0);
      nodes.current[l.key] = { src, g };
    });
    const longest = ready.reduce((a, l) => Math.max(a, l.buffer.duration), 0);
    const first = Object.values(nodes.current)[0];
    first.src.onended = () => setPlaying(false);
    startedAt.current = t0;
    setPlaying(true);
    return longest;
  };

  useEffect(() => {
    Object.entries(nodes.current).forEach(([k, n]) => { n.g.gain.value = gainOf(k); });
  }); // live gains follow the controls

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setPos(Math.max(0, ctxRef.current.currentTime - startedAt.current)), 200);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => stop, [lanes]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (k, patch) => setMix((m) => ({ ...m, [k]: { ...state(k), ...patch } }));
  return { playing, pos, play, stop, state, update, gainOf };
}