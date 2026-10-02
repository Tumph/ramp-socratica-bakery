import type { IconName } from "@/lib/ramp/types";

// Every glyph is an asset exported from the design, served from /public.
export function RampIcon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <img
      src={`/ramp/icons/${name}.svg`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={className ? `rampIcon ${className}` : "rampIcon"}
      style={{ width: size, height: size }}
    />
  );
}
