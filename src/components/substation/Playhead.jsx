import { useEffect, useRef } from 'react';

// Moves itself with a compositor-only transform. Keeping the playhead out of
// React is what lets the timeline stay completely idle during playback.
export default function Playhead({ engine, pxPerBeat }) {
  const ref = useRef(null);
  const scale = useRef(pxPerBeat);
  scale.current = pxPerBeat;

  useEffect(() => {
    let raf;
    let lastX = -1;
    const tick = () => {
      const x = engine.position() * scale.current;
      if (ref.current && Math.abs(x - lastX) > 0.5) {
        ref.current.style.transform = `translate3d(${x}px,0,0)`;
        lastX = x;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  return (
    <div ref={ref}
      className="absolute top-0 bottom-0 left-0 w-px bg-[#14b8a6] pointer-events-none will-change-transform"
      style={{ boxShadow: '0 0 8px #14b8a6' }} />
  );
}