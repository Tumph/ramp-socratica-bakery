"use client";

/**
 * Temporary scaffolding for demoing states before the data is wired up.
 *
 * Renders nothing outside `next dev` — the check is on `process.env.NODE_ENV`,
 * which Next inlines at build time, so the markup is dropped from production
 * bundles rather than merely hidden.
 */
export function DevStateToggle({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="rampDevToggle" role="group" aria-label={`${label} (development only)`}>
      <span className="rampDevToggleLabel">{label}</span>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={option.id === value ? "rampDevToggleBtn rampDevToggleBtn--on" : "rampDevToggleBtn"}
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
