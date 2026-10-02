"use client";

export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
}) {
  const canDecrease = value > min;
  const canIncrease = max === undefined || value < max;

  return (
    <div className="shopStepper">
      <button
        type="button"
        onClick={() => canDecrease && onChange(value - 1)}
        disabled={!canDecrease}
        aria-label="Decrease quantity"
      >
        <img src="/store/minus.svg" alt="" aria-hidden />
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        onClick={() => canIncrease && onChange(value + 1)}
        disabled={!canIncrease}
        aria-label="Increase quantity"
      >
        <img src="/store/plus.svg" alt="" aria-hidden />
      </button>
    </div>
  );
}
