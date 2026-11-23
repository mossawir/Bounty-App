import { useCallback, useEffect, useRef, useState } from 'react';

function readValue<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * State that survives reloads and stays in sync across tabs.
 * The `storage` listener is removed on unmount like any other subscription.
 */
export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readValue(key, initialValue));
  const keyRef = useRef(key);

  keyRef.current = key;

  const update = useCallback((next: T | ((current: T) => T)) => {
    setValue((current) => {
      const resolved = typeof next === 'function' ? (next as (c: T) => T)(current) : next;
      try {
        localStorage.setItem(keyRef.current, JSON.stringify(resolved));
      } catch {
        // Ignore quota/private-mode failures: state still works for this session.
      }
      return resolved;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== keyRef.current || event.newValue === null) return;
      try {
        setValue(JSON.parse(event.newValue) as T);
      } catch {
        // A malformed value from another tab is not worth crashing over.
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return [value, update];
}
