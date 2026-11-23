import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Single-page apps do not reload, so screen readers are not told the page changed.
 * This announces the new title and moves focus to the main landmark.
 */
export function RouteAnnouncer() {
  const location = useLocation();
  const [message, setMessage] = useState('');
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const main = document.getElementById('main');
    main?.focus({ preventScroll: true });

    // Titles are set by each page via useDocumentTitle; read after paint.
    const timer = setTimeout(() => setMessage(document.title), 60);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
