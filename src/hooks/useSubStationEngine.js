import { useCallback, useEffect, useRef, useState } from 'react';
import SubEngine from '@/lib/substation/engine';

// Owns the engine instance and the transport clock. Position is polled from the
// engine (which derives it from the audio clock) so UI frame drops never drift.
export default function useSubStationEngine(session) {
  const engineRef = useRef(null);
  const sessionRef = useRef(session);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [position, setPosition] = useState(0);
  const [cpu, setCpu] = useState(0);

  sessionRef.current = session;
  if (!engineRef.current) engineRef.current = new SubEngine();
  const engine = engineRef.current;

  useEffect(() => () => engine.dispose(), [engine]);

  // Keep the live graph in step with the mixer without rebuilding it
  useEffect(() => {
    if (!engine.ctx) return;
    engine.syncTracks(session.tracks);
    engine.applyFx(session.fx);
  }, [engine, session.tracks, session.fx]);

  useEffect(() => {
    let raf;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const frame = now - last;
      last = now;
      setCpu((c) => c * 0.9 + Math.min(100, (frame / 16.7) * 18) * 0.1);
      if (engine.playing) {
        const pos = engine.position();
        const s = sessionRef.current;
        if (s.loop.enabled && pos >= s.loop.end) {
          engine.play(s, s.loop.start);
        } else {
          setPosition(pos);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const play = useCallback(async (fromBeat) => {
    const s = sessionRef.current;
    await engine.play(s, fromBeat ?? engine.startBeat ?? 0);
    setPlaying(true);
  }, [engine]);

  const pause = useCallback(() => { engine.pause(); setPlaying(false); setPosition(engine.startBeat); }, [engine]);
  const stop = useCallback(() => { engine.stop(); setPlaying(false); setRecording(false); setPosition(0); }, [engine]);
  const seek = useCallback((beat) => { engine.startBeat = Math.max(0, beat); setPosition(Math.max(0, beat)); if (engine.playing) engine.play(sessionRef.current, beat); }, [engine]);

  return { engine, playing, recording, setRecording, position, cpu, play, pause, stop, seek };
}