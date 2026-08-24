import { useCallback, useEffect, useRef, useState } from 'react';
import SubEngine from '@/lib/substation/engine';

// Owns the engine instance and transport STATE ONLY (playing / recording).
// The playhead, clock and meters deliberately read the engine directly from
// their own animation frames: routing the audio clock through React state
// re-rendered the whole workstation 60x a second, which is what made playback
// feel like it was dragging.
export default function useSubStationEngine(session) {
  const engineRef = useRef(null);
  const sessionRef = useRef(session);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);

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

  // Loop wrap — a coarse timer is plenty and costs nothing between checks
  useEffect(() => {
    const id = setInterval(() => {
      if (!engine.playing) return;
      const s = sessionRef.current;
      if (s.loop.enabled && engine.position() >= s.loop.end) engine.play(s, s.loop.start);
    }, 60);
    return () => clearInterval(id);
  }, [engine]);

  const play = useCallback(async (fromBeat) => {
    await engine.play(sessionRef.current, fromBeat ?? engine.startBeat ?? 0);
    setPlaying(true);
  }, [engine]);

  const pause = useCallback(() => { engine.pause(); setPlaying(false); }, [engine]);
  const stop = useCallback(() => { engine.stop(); setPlaying(false); setRecording(false); }, [engine]);
  const seek = useCallback((beat) => {
    const b = Math.max(0, beat);
    engine.startBeat = b;
    if (engine.playing) engine.play(sessionRef.current, b);
  }, [engine]);

  return { engine, playing, recording, setRecording, play, pause, stop, seek };
}