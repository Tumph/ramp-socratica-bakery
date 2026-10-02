import type { ReactNode } from "react";
import type { NavItem } from "@/lib/ramp/types";
import { RampSidebar } from "./RampSidebar";
import { RampTopBar } from "./RampTopBar";

/** Sidebar + top bar chrome shared by every signed-in Ramp screen. */
export function RampAppShell({
  nav,
  children,
}: {
  nav: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="rampApp">
      <RampSidebar items={nav} />
      <div className="rampMain">
        <RampTopBar />
        <div className="rampContent">{children}</div>
      </div>
    </div>
  );
}
