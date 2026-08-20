import { useCallback, useEffect, useRef, useState } from 'react';
import { getElementAudioGraph } from '@/hooks/useAudioAnalyzer';
import { buildFoundryInsert, isInsertable } from '@/lib/foundry/foundryInsert';

/**
 * useLivePatchRack
 * Hot-swappable Foundry patch insert on the Live Studio playback path.
 *
 * Splices into the SAME element graph the visualizer analyser already uses
 * (source → analyser → …), so nothing creates a second MediaElementSource:
 *
 *   analyser → dryGain ─┐
 *            → patch → wetGain ─┴→ destination
 *
 * Wet/dry crossfade is the macro: at 0 the rack is audibly bypassed, at 100 the
 * performance runs fully through the creator's own patch. Swapping mid-set only
 * re-routes live audio — nothing is written to any asset.
 */
export default function useLivePatchRack(audioRef) {
  const [armed, setArmed] = useState(null);   // FoundryPlugin currently in the rack
  const [mix, setMixState] = useState(100);   // 0..100 wet amount
  const [busy, setBusy] = useState(false);

  const graphRef = useRef(null);
  const dryRef = useRef(null);
  const wetRef = useRef(null);
  const insertRef = useRef(null);

  // Build the dry/wet split once, replacing analyser → destination.
  const ensureSplit = useCallback(() => {
    if (dryRef.current) return graphRef.current;
    const graph = getElementAudioGraph(audioRef?.current);
    if (!graph) return null;
    const { ctx, analyser } = graph;
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    dry.gain.value = 1;
    wet.gain.value = 0;
    try { analyser.disconnect(); } catch {}
    analyser.connect(dry);
    dry.connect(ctx.destination);
    wet.connect(ctx.destination);
    graphRef.current = graph;
    dryRef.current = dry;
    wetRef.current = wet;
    return graph;
  }, [audioRef]);

  const applyMix = useCallback((value) => {
    const dry = dryRef.current, wet = wetRef.current, graph = graphRef.current;
    if (!dry || !wet || !graph) return;
    const w = insertRef.current ? Math.max(0, Math.min(100, value)) / 100 : 0;
    const t = graph.ctx.currentTime;
    wet.gain.setTargetAtTime(w, t, 0.02);
    dry.gain.setTargetAtTime(1 - w, t, 0.02);
  }, []);

  const setMix = useCallback((value) => {
    setMixState(value);
    applyMix(value);
  }, [applyMix]);

  /** Arm a patch (or pass null to clear the rack). */
  const arm = useCallback(async (plugin) => {
    const graph = ensureSplit();
    if (!graph) return;
    setBusy(true);
    try {
      if (insertRef.current) {
        insertRef.current.dispose();
        insertRef.current = null;
      }
      if (plugin && isInsertable(plugin.graph_state)) {
        const insert = await buildFoundryInsert(graph.ctx, plugin.graph_state);
        graph.analyser.connect(insert.input);
        insert.output.connect(wetRef.current);
        insertRef.current = insert;
        setArmed(plugin);
      } else {
        setArmed(null);
      }
      applyMix(plugin ? mix : 0);
    } finally {
      setBusy(false);
    }
  }, [ensureSplit, applyMix, mix]);

  // Leaving the studio must not leave a patch running on the audio path.
  useEffect(() => () => {
    if (insertRef.current) { insertRef.current.dispose(); insertRef.current = null; }
    if (dryRef.current) { try { dryRef.current.gain.value = 1; } catch {} }
    if (wetRef.current) { try { wetRef.current.gain.value = 0; } catch {} }
  }, []);

  return { armed, mix, busy, arm, setMix };
}