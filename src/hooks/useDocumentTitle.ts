import { useEffect } from 'react';

const SUFFIX = 'The Bug Bazaar';

/** Per-route document title, restored when the route unmounts. */
export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} — ${SUFFIX}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
