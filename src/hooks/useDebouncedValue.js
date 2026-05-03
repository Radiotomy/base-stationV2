import { useState, useEffect } from 'react';

/**
 * Returns a debounced version of a value.
 * Useful for heavy inputs (textareas, search boxes) to prevent
 * expensive re-renders or API calls on every keystroke.
 */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}