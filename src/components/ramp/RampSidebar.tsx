"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/ramp/types";
import { RampIcon } from "./RampIcon";

function NavRowContent({ item }: { item: NavItem }) {
  return (
    <>
      <RampIcon name={item.icon} size={12} />
      <span className="rampNavLabel">{item.label}</span>
      {item.badge !== undefined && <span className="rampNavBadge">{item.badge}</span>}
    </>
  );
}

export function RampSidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="rampSidebar" aria-label="Primary">
      <div className="rampSidebarHead">
        <Link href="/ramp/home" aria-label="Ramp home">
          <RampIcon name="logo-mark-grey" size={22} />
        </Link>
      </div>

      <ul className="rampNav">
        {items.map((item) => {
          // No href means the destination does not exist yet: render an inert
          // button so it still looks and focuses like a nav row.
          if (!item.href) {
            return (
              <li key={item.id}>
                <button type="button" className="rampNavItem rampNavItem--inert" aria-disabled>
                  <NavRowContent item={item} />
                </button>
              </li>
            );
          }

          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className={active ? "rampNavItem rampNavItem--active" : "rampNavItem"}
                aria-current={active ? "page" : undefined}
              >
                <NavRowContent item={item} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
