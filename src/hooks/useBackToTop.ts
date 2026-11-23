import { useCallback, useEffect, useState } from 'react';

/**
 * Back to Top: one of the window listeners the brief asks us to clean up.
 * The scroll handler is throttled with requestAnimationFrame and removed on unmount,
 * and the listener is added with `passive` so it never blocks scrolling.
 */
export function useBackToTop(threshold = 520): { visible: boolean; scrollToTop: () => void } {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let frame = 0;

    const onScroll = (): void => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setVisible(window.scrollY > threshold);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [threshold]);

  const scrollToTop = useCallback(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, []);

  return { visible, scrollToTop };
}
