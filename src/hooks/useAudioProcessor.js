import { useEffect, useRef, useState } from "react";

/**
 * Builds a shared Web Audio graph for an existing <audio> element:
 *   source → [5 biquad filters] → analyserL ┐
 *                                 analyserR ┴→ destination
 *
 * Returns:
 *   - setBandGain(i, dB): adjust one of 5 EQ bands
 *   - analyserL / analyserR: stereo analyser nodes for VU metering
 *   - ready: true once the audio graph is wired
 */
export const EQ_BANDS = [
  { freq: 60,    label: "60" },
  { freq: 250,   label: "250" },
  { freq: 1000,  label: "1k" },
  { freq: 4000,  label: "4k" },
  { freq: 12000, label: "12k" },
];

export default function useAudioProcessor(audioRef) {
  const ctxRef = useRef(null);
  const sourceRef = useRef(null);
  const filtersRef = useRef([]);
  const splitterRef = useRef(null);
  const analyserLRef = useRef(null);
  const analyserRRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || ctxRef.current) return;

    const setup = () => {
      if (ctxRef.current) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        const source = ctx.createMediaElementSource(el);

        // Build 5 peaking biquad filters in series
        const filters = EQ_BANDS.map((b, i) => {
          const f = ctx.createBiquadFilter();
          // Edges use shelving, mids use peaking — classic EQ feel
          if (i === 0) f.type = "lowshelf";
          else if (i === EQ_BANDS.length - 1) f.type = "highshelf";
          else f.type = "peaking";
          f.frequency.value = b.freq;
          f.Q.value = 1.0;
          f.gain.value = 0;
          return f;
        });

        // Chain source → f0 → f1 → ... → fN
        source.connect(filters[0]);
        for (let i = 0; i < filters.length - 1; i++) {
          filters[i].connect(filters[i + 1]);
        }
        const tail = filters[filters.length - 1];

        // Stereo split for L/R VU
        const splitter = ctx.createChannelSplitter(2);
        tail.connect(splitter);

        const analyserL = ctx.createAnalyser();
        const analyserR = ctx.createAnalyser();
        analyserL.fftSize = 1024;
        analyserR.fftSize = 1024;
        analyserL.smoothingTimeConstant = 0.6;
        analyserR.smoothingTimeConstant = 0.6;
        splitter.connect(analyserL, 0);
        splitter.connect(analyserR, 1);

        // Also send tail to destination so audio is heard
        tail.connect(ctx.destination);

        ctxRef.current = ctx;
        sourceRef.current = source;
        filtersRef.current = filters;
        splitterRef.current = splitter;
        analyserLRef.current = analyserL;
        analyserRRef.current = analyserR;
        setReady(true);
      } catch (err) {
        // Audio context may fail if element source is cross-origin without CORS, etc.
        console.warn("Audio processor setup failed:", err);
      }
    };

    // Resume on user interaction (autoplay policy)
    const resume = () => {
      setup();
      if (ctxRef.current?.state === "suspended") {
        ctxRef.current.resume().catch(() => {});
      }
    };

    el.addEventListener("play", resume);
    return () => {
      el.removeEventListener("play", resume);
    };
  }, [audioRef]);

  const setBandGain = (i, dB) => {
    const f = filtersRef.current[i];
    if (f) f.gain.value = dB;
  };

  return {
    ready,
    setBandGain,
    analyserL: analyserLRef,
    analyserR: analyserRRef,
  };
}