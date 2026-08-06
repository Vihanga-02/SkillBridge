import { useEffect, useState } from 'react';

/**
 * Delays a fast-changing value. Search inputs use this so a five-letter query is
 * one Firestore read instead of five.
 */
export function useDebounce<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
