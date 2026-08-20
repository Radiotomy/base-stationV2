import { useCallback, useEffect, useRef, useState } from 'react';
import FoundryEngine from '@/lib/foundry/audioEngine';

// Owns one FoundryEngine for the lifetime of a workspace and keeps its live audio
// graph in step with the canvas.
//
// Rebuild policy: topology changes rebuild, parameter changes do not. That split
// is the whole reason turning a knob mid-playback doesn't click — a rebuild is
// cheap but not free, and doing one per knob frame would be audible.
export default function useFoundryEngine() {
  const engineRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [bypassed, setBypassed] = useState(false);
  const [bpm, setBpm] = useState(120);

  if (!engineRef.current) engineRef.current = new FoundryEngine();
  const engine = engineRef.current;

  useEffect(() => () => { engine.destroy(); }, [engine]);

  const rebuild = useCallback(async (graph) => {
    if (!engine.running && !running) return;
    await engine.build(graph);
  }, [engine, running]);

  const start = useCallback(async (graph) => {
    await engine.ensureContext();
    await engine.build(graph);
    engine.setBpm(bpm);
    // Only feed the test signal when the patch actually has an input stage;
    // an instrument makes its own sound and would just be muddied by it.
    if ((graph.nodes || []).some((n) => n.type === 'input')) engine.startTestLoop();
    engine.triggerEnvelopes();
    setRunning(true);
  }, [engine, bpm]);

  const stop = useCallback(() => {
    engine.stopTestLoop();
    engine.releaseEnvelopes();
    engine.destroy().then(() => setRunning(false));
    setMicOn(false);
  }, [engine]);

  const setParam = useCallback(async (graph, nodeId, key, value) => {
    const handled = engine.setParam(nodeId, key, value);
    if (!handled && running) await engine.build(graph);
  }, [engine, running]);

  const toggleMic = useCallback(async () => {
    if (micOn) { engine.stopMic(); setMicOn(false); return; }
    await engine.startMic();
    setMicOn(true);
  }, [engine, micOn]);

  const toggleBypass = useCallback(() => {
    const next = !bypassed;
    engine.setBypass(next);
    setBypassed(next);
  }, [engine, bypassed]);

  const changeBpm = useCallback((next) => {
    setBpm(next);
    engine.setBpm(next);
  }, [engine]);

  return {
    engine, running, micOn, bypassed, bpm,
    start, stop, rebuild, setParam, toggleMic, toggleBypass, changeBpm,
    trigger: () => engine.triggerEnvelopes(),
  };
}