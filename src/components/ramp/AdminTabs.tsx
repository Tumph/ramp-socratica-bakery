"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminConsole, type AdminRecord, type AdminTeam } from "@/components/AdminConsole";
import { FacilitatorOrders, type FacilitatorOrder } from "@/components/FacilitatorOrders";
import { ProductAdmin } from "./ProductAdmin";
import { VendorAdmin } from "./VendorAdmin";

const TABS = ["Products", "Vendors", "Teams", "Orders"] as const;
type Tab = (typeof TABS)[number];

export function AdminTabs({
  teams,
  admins,
  deadline,
  actorRole,
  orders,
}: {
  teams: AdminTeam[];
  admins: AdminRecord[];
  deadline: string;
  actorRole: "ADMIN" | "SUPERADMIN";
  orders: FacilitatorOrder[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Products");

  return (
    <div className="rampAdmin">
      <header className="rampAdminHead">
        <h1>Admin</h1>
        <div className="rampAdminHeadActions">
          <button
            type="button"
            className="rampBtn rampBtn--secondary"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.replace("/");
              router.refresh();
            }}
          >
            Log out
          </button>
        </div>
      </header>

      <div className="rampTabs" role="tablist" aria-label="Admin sections">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            className={tab === name ? "rampTab rampTab--active" : "rampTab"}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="rampAdminBody">
        {tab === "Products" ? <ProductAdmin /> : null}
        {tab === "Vendors" ? <VendorAdmin /> : null}
        {tab === "Teams" ? <AdminConsole teams={teams} admins={admins} deadline={deadline} actorRole={actorRole} className="rampFacilitator" /> : null}
        {tab === "Orders" ? <FacilitatorOrders initialOrders={orders} className="rampFacilitator" /> : null}
      </div>
    </div>
  );
}
