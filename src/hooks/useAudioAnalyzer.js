import { useEffect, useRef, useState } from 'react';

/**
 * Phase 5.7 — useAudioAnalyzer
 * Wires an HTMLAudioElement (via ref) into a Web Audio AnalyserNode and exposes
 * spectrum data + summary bands (bass / mid / treble / peak) for visualizers.
 *
 * Pure local audio analysis — no event-bus involvement.
 */
export function useAudioAnalyzer(audioRef, { fftSize = 256, enabled = true } = {}) {
  const [data, setData] = useState({
    spectrum: new Array(fftSize / 2).fill(0),
    peak: 0,
    bass: 0,
    mid: 0,
    treble: 0,
  });

  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    const el = audioRef?.current;
    if (!el) return;

    let cancelled = false;

    const setup = () => {
      try {
        if (!ctxRef.current) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          ctxRef.current = new Ctx();
        }
        if (!sourceRef.current) {
          sourceRef.current = ctxRef.current.createMediaElementSource(el);
          analyserRef.current = ctxRef.current.createAnalyser();
          analyserRef.current.fftSize = fftSize;
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(ctxRef.current.destination);
        }
      } catch {
        // createMediaElementSource throws if already connected; safe to ignore.
      }
    };

    const tick = () => {
      if (cancelled) return;
      const analyser = analyserRef.current;
      if (analyser) {
        const buf = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buf);
        const len = buf.length;
        const third = Math.floor(len / 3);
        let bassSum = 0, midSum = 0, trebleSum = 0, peak = 0;
        for (let i = 0; i < len; i++) {
          const v = buf[i];
          if (v > peak) peak = v;
          if (i < third) bassSum += v;
          else if (i < 2 * third) midSum += v;
          else trebleSum += v;
        }
        setData({
          spectrum: Array.from(buf),
          peak: peak / 255,
          bass: (bassSum / third) / 255,
          mid: (midSum / third) / 255,
          treble: (trebleSum / (len - 2 * third)) / 255,
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    setup();
    // Resume context on first user interaction (browser autoplay policy)
    const resume = () => { ctxRef.current?.resume?.().catch(() => {}); };
    el.addEventListener('play', resume);

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      el.removeEventListener('play', resume);
    };
  }, [audioRef, enabled, fftSize]);

  return data;
}