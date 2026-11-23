import { useAppSelector } from '@/app/hooks';
import { selectSocketStatus } from '@/features/realtime/realtimeSlice';

const LABELS: Record<string, string> = {
  open: 'Live stock',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  closed: 'Stock paused',
};

/** Small, honest indicator: the feed's state is visible, not implied. */
export function SocketStatusChip() {
  const status = useAppSelector(selectSocketStatus);

  return (
    <span className="live-chip" title="Live stock feed">
      <span className="live-dot" data-status={status} aria-hidden="true" />
      <span className="live-chip-text" aria-live="polite">
        {LABELS[status] ?? 'Stock paused'}
      </span>
    </span>
  );
}
