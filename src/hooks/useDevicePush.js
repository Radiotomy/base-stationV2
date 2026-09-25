import { useCallback, useRef, useState } from 'react';

// Coalesces knob moves into at most one Nexus transaction per animation frame,
// so dragging a Foundry knob moves the Audiotool knob live without flooding sync.
export default function useDevicePush(nexus) {
  const queue = useRef(new Map());
  const frame = useRef(0);
  const [error, setError] = useState('');

  const flush = useCallback(async () => {
    frame.current = 0;
    const items = [...queue.current.values()];
    queue.current.clear();
    const errors = [];
    await nexus.modify((t) => {
      for (const { field, value, label } of items) {
        const err = t.tryUpdate(field, value);
        if (err) errors.push(`${label}: ${err}`);
      }
    });
    setError(errors[0] || '');
  }, [nexus]);

  const push = useCallback((key, field, value, label) => {
    queue.current.set(key, { field, value, label });
    if (!frame.current) frame.current = requestAnimationFrame(() => flush().catch((e) => setError(e.message)));
  }, [flush]);

  return { push, error };
}