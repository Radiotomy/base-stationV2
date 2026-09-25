import { useEffect, useRef } from 'react';
import abcjs from 'abcjs';

/** Renders an ABC notation string as sheet music on a paper-style surface. */
export default function AbcScoreView({ abc }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && abc) abcjs.renderAbc(ref.current, abc, { responsive: 'resize' });
  }, [abc]);

  if (!abc) return null;
  return (
    <div className="rounded-xl bg-primary text-primary-foreground p-4 overflow-x-auto">
      <div ref={ref} />
    </div>
  );
}