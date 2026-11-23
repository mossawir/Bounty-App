import { MinusIcon, PlusIcon } from '@/components/icons';

interface QuantityStepperProps {
  value: number;
  max: number;
  onChange: (next: number) => void;
  /** Describes what is being counted, used in the button labels. */
  label: string;
  min?: number;
  size?: 'sm' | 'md';
}

export function QuantityStepper({
  value,
  max,
  onChange,
  label,
  min = 1,
  size = 'md',
}: QuantityStepperProps) {
  const atMax = value >= max;
  const atMin = value <= min;

  return (
    <div className="qty" data-size={size}>
      <button
        type="button"
        aria-label={`Decrease quantity of ${label}`}
        onClick={() => onChange(value - 1)}
        disabled={atMin}
      >
        <MinusIcon size={16} />
      </button>
      <output aria-live="polite" aria-label={`Quantity of ${label}`}>
        {value}
      </output>
      <button
        type="button"
        aria-label={`Increase quantity of ${label}`}
        onClick={() => onChange(value + 1)}
        disabled={atMax}
      >
        <PlusIcon size={16} />
      </button>
    </div>
  );
}
