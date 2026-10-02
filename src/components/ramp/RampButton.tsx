import type { ReactNode } from "react";
import type { IconName } from "@/lib/ramp/types";
import { RampIcon } from "./RampIcon";

type Variant = "primary" | "secondary";

type Props = {
  children: ReactNode;
  variant?: Variant;
  /** Glyph before the label, as on "My wallet". */
  iconBefore?: IconName;
  /** Glyph after the label, as on "New ⌄" and "Get extension ↗". */
  iconAfter?: IconName;
  block?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
};

/**
 * `primary` is the yellow fill (#e4f222); `secondary` is the white pill with a
 * grey border used by every row action.
 */
export function RampButton({
  children,
  variant = "secondary",
  iconBefore,
  iconAfter,
  block,
  type = "button",
  onClick,
  className,
}: Props) {
  const classes = ["rampBtn", `rampBtn--${variant}`, block ? "rampBtn--block" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} onClick={onClick}>
      {iconBefore && <RampIcon name={iconBefore} />}
      <span>{children}</span>
      {iconAfter && <RampIcon name={iconAfter} />}
    </button>
  );
}
