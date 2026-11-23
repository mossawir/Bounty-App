import { ArrowUpIcon } from '@/components/icons';
import { useBackToTop } from '@/hooks/useBackToTop';

/** Fixed "back to top" control that only appears once you have scrolled a screen. */
export function BackToTop({ threshold = 520 }: { threshold?: number }) {
  const { visible, scrollToTop } = useBackToTop(threshold);

  return (
    <button
      type="button"
      className="back-to-top"
      data-visible={visible}
      onClick={scrollToTop}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
    >
      <ArrowUpIcon size={20} />
    </button>
  );
}
