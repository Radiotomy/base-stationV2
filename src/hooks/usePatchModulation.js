import { useEffect, useRef, useState } from 'react';
import FoundryEngine from '@/lib/foundry/audioEngine';

/**
 * Runs a Foundry patch as a SILENT modulation source and reports its LFO /
 * envelope values in real time.
 *
 * The engine is muted on purpose: the point is the movement of the patch's
 * modulators, not its sound. Nothing here touches the visualizer's own audio
 * graph, so a tap can never colour or double the track being visualised.
 */
export default function usePatchModulation(graph, { bpm = 120, active = false } = {}) {
  const engineRef = useRef(null);
  const rafRef = useRef(null);
  const beatRef = useRef(null);
  const [taps, setTaps] = useState([]);

  useEffect(() => {
    if (!active || !graph?.nodes?.length) {
      setTaps([]);
      return;
    }
    let cancelled = false;
    const engine = new FoundryEngine();
    engineRef.current = engine;

    (async () => {
      await engine.build(graph);
      if (cancelled) return;
      engine.setBpm(bpm);
      engine.setBypass(true); // silent — modulation only

      // Envelopes rest at zero until something plays a note, so the tap pulses
      // them on the beat; otherwise an ADSR would read as a dead source.
      const beat = (60 / bpm) * 1000;
      beatRef.current = setInterval(() => {
        engine.triggerEnvelopes();
        setTimeout(() => engine.releaseEnvelopes(), beat * 0.4);
      }, beat);

      const loop = () => {
        setTaps(engine.getModulation());
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      clearInterval(beatRef.current);
      engine.destroy();
      engineRef.current = null;
    };
  }, [graph, bpm, active]);

  // Single combined value for consumers that just want "how much movement now".
  const level = taps.length
    ? taps.reduce((m, t) => Math.max(m, t.value), 0)
    : 0;

  return { taps, level };
}