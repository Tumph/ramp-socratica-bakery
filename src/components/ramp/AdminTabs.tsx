"use client";

import { useState } from "react";
import { catalog } from "@/lib/catalog";
import type { SimulatorConfig, TeamCard, Vendor } from "@/lib/ramp/config";
import { useRampConfig } from "./RampConfigProvider";

export type LiveTeam = {
  id: string;
  name: string;
  status: string;
  availableCents: number;
  fundLimitCents: number;
  memberCount: number;
  orderCount: number;
};

export type LiveOrder = {
  id: string;
  invoice_number: string;
  status: string;
  total_cents: number;
  team_name: string;
  created_at: string;
};

const TABS = ["Vendors", "Teams", "Cards", "Event", "Orders"] as const;
type Tab = (typeof TABS)[number];

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------------------------------------------------------------- Vendors */

function VendorsTab({ config, update }: { config: SimulatorConfig; update: (c: SimulatorConfig) => void }) {
  function patch(id: string, changes: Partial<Vendor>) {
    update({ ...config, vendors: config.vendors.map((v) => (v.id === id ? { ...v, ...changes } : v)) });
  }

  function toggleProduct(vendor: Vendor, productId: string) {
    const owned = vendor.productIds.includes(productId);
    // A product belongs to one vendor, so claiming it removes it elsewhere.
    update({
      ...config,
      vendors: config.vendors.map((v) => {
        if (v.id === vendor.id) {
          return { ...v, productIds: owned ? v.productIds.filter((p) => p !== productId) : [...v.productIds, productId] };
        }
        return owned ? v : { ...v, productIds: v.productIds.filter((p) => p !== productId) };
      }),
    });
  }

  return (
    <div className="rampAdminStack">
      <p className="rampAdminNote">
        Each vendor sells its own products on the bakery store. A purchase becomes an incomplete
        expense tagged with that vendor, and its memo prefills the expense.
      </p>

      {config.vendors.map((vendor) => (
        <section key={vendor.id} className="rampAdminCard">
          <div className="rampAdminGrid">
            <label>
              <span>Vendor name</span>
              <input value={vendor.name} onChange={(e) => patch(vendor.id, { name: e.target.value })} />
            </label>
            <label>
              <span>Autofill memo</span>
              <input value={vendor.autofillMemo} onChange={(e) => patch(vendor.id, { autofillMemo: e.target.value })} />
            </label>
          </div>

          <fieldset className="rampAdminFieldset">
            <legend>Products</legend>
            <div className="rampAdminChecks">
              {catalog.map((product) => {
                const owner = config.vendors.find((v) => v.productIds.includes(product.id));
                const mine = owner?.id === vendor.id;
                return (
                  <label key={product.id} className={mine ? "rampAdminCheck rampAdminCheck--on" : "rampAdminCheck"}>
                    <input type="checkbox" checked={mine} onChange={() => toggleProduct(vendor, product.id)} />
                    <span>{product.emoji} {product.name}</span>
                    <small>${money(product.priceCents)}</small>
                    {owner && !mine && <em>{owner.name}</em>}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Teams */

function TeamsTab({ config, update }: { config: SimulatorConfig; update: (c: SimulatorConfig) => void }) {
  return (
    <div className="rampAdminStack">
      <p className="rampAdminNote">
        The active team is what the Ramp pages render. Each team has its own viewer and cards.
      </p>

      {config.teams.map((team) => (
        <section key={team.id} className="rampAdminCard">
          <div className="rampAdminRowHead">
            <label className="rampAdminRadio">
              <input
                type="radio"
                name="active-team"
                checked={config.activeTeamId === team.id}
                onChange={() => update({ ...config, activeTeamId: team.id })}
              />
              <span>Active</span>
            </label>
            <span className="rampAdminCount">{team.cards.length} card{team.cards.length === 1 ? "" : "s"}</span>
          </div>

          <div className="rampAdminGrid">
            <label>
              <span>Team name</span>
              <input
                value={team.name}
                onChange={(e) =>
                  update({ ...config, teams: config.teams.map((t) => (t.id === team.id ? { ...t, name: e.target.value } : t)) })
                }
              />
            </label>
            <label>
              <span>Viewer first name</span>
              <input
                value={team.viewer.firstName}
                onChange={(e) =>
                  update({
                    ...config,
                    teams: config.teams.map((t) =>
                      t.id === team.id ? { ...t, viewer: { ...t.viewer, firstName: e.target.value } } : t,
                    ),
                  })
                }
              />
            </label>
            <label>
              <span>Initials</span>
              <input
                maxLength={2}
                value={team.viewer.initials}
                onChange={(e) =>
                  update({
                    ...config,
                    teams: config.teams.map((t) =>
                      t.id === team.id ? { ...t, viewer: { ...t.viewer, initials: e.target.value.toUpperCase() } } : t,
                    ),
                  })
                }
              />
            </label>
          </div>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Cards */

function CardsTab({ config, update }: { config: SimulatorConfig; update: (c: SimulatorConfig) => void }) {
  const [teamId, setTeamId] = useState(config.activeTeamId);
  const team = config.teams.find((t) => t.id === teamId) ?? config.teams[0];

  function patchCard(cardId: string, changes: Partial<TeamCard>) {
    update({
      ...config,
      teams: config.teams.map((t) =>
        t.id !== team.id ? t : { ...t, cards: t.cards.map((c) => (c.id === cardId ? { ...c, ...changes } : c)) },
      ),
    });
  }

  return (
    <div className="rampAdminStack">
      <label className="rampAdminSelect">
        <span>Team</span>
        <select value={team.id} onChange={(e) => setTeamId(e.target.value)}>
          {config.teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>

      {team.cards.map((card) => (
        <section key={card.id} className="rampAdminCard">
          <div className="rampAdminGrid">
            <label className="rampAdminWide">
              <span>Card name</span>
              <input value={card.name} onChange={(e) => patchCard(card.id, { name: e.target.value })} />
            </label>
            <label>
              <span>Limit ({card.currency})</span>
              <input
                type="number"
                value={card.limitCents / 100}
                onChange={(e) => patchCard(card.id, { limitCents: Math.round(Number(e.target.value) * 100) })}
              />
            </label>
            <label>
              <span>Remaining ({card.currency})</span>
              <input
                type="number"
                value={card.remainingCents / 100}
                onChange={(e) => patchCard(card.id, { remainingCents: Math.round(Number(e.target.value) * 100) })}
              />
            </label>
            <label>
              <span>Last 4</span>
              <input
                maxLength={4}
                value={card.displaySuffix}
                onChange={(e) => patchCard(card.id, { displaySuffix: e.target.value.replace(/\D/g, "") })}
              />
            </label>
          </div>
          <p className="rampAdminHint">Only the last four digits are stored — never a full card number.</p>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------- Event + Orders (live) */

function EventTab({ teams }: { teams: LiveTeam[] }) {
  return (
    <div className="rampAdminStack">
      <p className="rampAdminNote">
        Live from Supabase. Editing these still runs through the existing console at{" "}
        <a href="/facilitator">/facilitator</a> until the write operations are ported.
      </p>
      <table className="rampAdminTable">
        <thead>
          <tr><th>Team</th><th>Status</th><th>Members</th><th>Orders</th><th>Limit</th><th>Available</th></tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.id}>
              <td>{team.name}</td>
              <td>{team.status}</td>
              <td>{team.memberCount}</td>
              <td>{team.orderCount}</td>
              <td>${money(team.fundLimitCents)}</td>
              <td>${money(team.availableCents)}</td>
            </tr>
          ))}
          {teams.length === 0 && <tr><td colSpan={6}>No teams yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTab({ orders }: { orders: LiveOrder[] }) {
  return (
    <div className="rampAdminStack">
      <table className="rampAdminTable">
        <thead>
          <tr><th>Invoice</th><th>Team</th><th>Status</th><th>Total</th><th>Placed</th></tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.invoice_number}</td>
              <td>{order.team_name}</td>
              <td>{order.status}</td>
              <td>${money(order.total_cents)}</td>
              <td>{new Date(order.created_at).toLocaleString()}</td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={5}>No orders yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ Shell */

export function AdminTabs({ teams, orders }: { teams: LiveTeam[]; orders: LiveOrder[] }) {
  const [tab, setTab] = useState<Tab>("Vendors");
  const { config, update, reset } = useRampConfig();

  return (
    <div className="rampAdmin">
      <header className="rampAdminHead">
        <h1>Configuration</h1>
        <div className="rampAdminHeadActions">
          <button type="button" className="rampBtn rampBtn--secondary" onClick={reset}>
            Reset simulator data
          </button>
          <button
            type="button"
            className="rampBtn rampBtn--secondary"
            onClick={async () => {
              await fetch("/api/ramp-admin", { method: "DELETE" });
              window.location.reload();
            }}
          >
            Log out
          </button>
        </div>
      </header>

      <div className="rampTabs" role="tablist">
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
        {tab === "Vendors" ? (
          <VendorsTab config={config} update={update} />
        ) : tab === "Teams" ? (
          <TeamsTab config={config} update={update} />
        ) : tab === "Cards" ? (
          <CardsTab config={config} update={update} />
        ) : tab === "Event" ? (
          <EventTab teams={teams} />
        ) : (
          <OrdersTab orders={orders} />
        )}
      </div>
    </div>
  );
}
