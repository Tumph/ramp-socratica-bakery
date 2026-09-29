# Mock card-fund simulator plan

## Decision

Replace the Ramp Sandbox Bill Pay integration with a first-party, workshop-only card and fund simulator. The simulator has no connection to Ramp, a payment network, or a card processor.

Each bakery team has one shared CAD fund. Every active participant receives one nonfunctional display card linked to that fund. A supplier purchase checks the participant's card and the team's available balance, then creates the simulated transaction and fulfills the purchased inventory.

Use an unmistakably fictional card identifier, such as `BAKE-2026-0042` or `•••• 0042`. Do not generate or store a payment-card number, CVV, expiry date, or other usable payment credential.

## Participant flow

1. An Admin funds a team.
2. The system issues a mock card to each active team participant.
3. A participant selects supplies in the supplier shop and confirms a purchase using their mock card.
4. The backend calculates the price from the server-owned catalogue, verifies the cardholder and team membership, and atomically posts the purchase.
5. The shared fund decreases, a transaction appears in the mock financial workspace, and the supplies are added to the team's inventory.
6. The participant sees their own card and purchases. Every active team member sees the shared available balance. Admins see all teams, cards, and transactions.

The normal supplier path creates a posted transaction immediately. Admin/demo controls can later create pending, reversed, declined, and refunded transactions to demonstrate a more realistic lifecycle.

## Domain model

| Object | Responsibility | Key fields |
|---|---|---|
| `team_funds` | One authoritative, spendable balance per team | `id`, `event_id`, `team_id` unique, `currency`, `available_cents`, `status`, timestamps |
| `mock_cards` | One nonfunctional card per participant | `id`, `fund_id`, `user_id`, `display_identifier`, `last4`, `status`, timestamps |
| `mock_authorizations` | A purchase attempt and its decision | `id`, `fund_id`, `card_id`, `order_id`, `amount_cents`, `merchant_name`, `status`, `idempotency_key`, timestamps |
| `mock_transactions` | A posted purchase, reversal, or refund shown in the transaction feed | `id`, `fund_id`, `card_id`, `authorization_id`, `order_id`, `type`, `status`, `amount_cents`, merchant fields, timestamps |
| `fund_ledger_entries` | Append-only audit trail for every fund movement | `id`, `fund_id`, `transaction_id`, `entry_type`, `amount_cents`, `balance_after_cents`, `actor_user_id`, timestamps |

`team_funds.available_cents` is the only source of spendable money. Do not retain a second authoritative balance on `teams.available_cash_cents` after the migration.

### Initial statuses

- Card: `ACTIVE`, `FROZEN`, `REVOKED`
- Authorization: `APPROVED`, `DECLINED`, `REVERSED`, `EXPIRED`, `CAPTURED`
- Transaction: `PENDING`, `POSTED`, `REVERSED`, `REFUNDED`, `DECLINED`
- Ledger entry: `INITIAL_FUNDING`, `ADMIN_ADJUSTMENT`, `AUTHORIZATION_HOLD`, `HOLD_RELEASE`, `PURCHASE`, `REVERSAL`, `REFUND`

## Required invariants

1. Amounts are nonnegative integer cents and currency is CAD.
2. A team has at most one active fund and a user has at most one active mock card per event.
3. The signed-in user must own the active card and remain an active member of the card's team.
4. A purchase amount is calculated from `src/lib/catalog.ts`; the browser never supplies an authoritative amount.
5. Each purchase request carries an idempotency key unique within its fund, so retrying a request cannot double-charge or double-fulfill.
6. Every balance-changing action writes a ledger entry. Admins never edit the stored available balance directly.
7. Purchases, order rows, transaction rows, ledger rows, and inventory updates happen in one database transaction.
8. The backend locks the team fund row before checking and decreasing its balance, so simultaneous purchases cannot overspend.
9. Removing or reassigning a participant revokes their old card before granting access to another team fund.

## Backend contract

Keep the designer-facing mock-finance UI behind stable application endpoints. It should not use direct Supabase table access.

```text
GET  /api/mock-ramp/overview
GET  /api/mock-ramp/cards/me
GET  /api/mock-ramp/transactions?cursor=...
GET  /api/mock-ramp/transactions/:id
POST /api/orders                         # supplier checkout; posts the simulated purchase
POST /api/admin                          # funding, adjustments, card status, and demo controls
```

Example transaction shape:

```ts
type MockTransaction = {
  id: string;
  status: "PENDING" | "POSTED" | "DECLINED" | "REVERSED" | "REFUNDED";
  type: "PURCHASE" | "REFUND" | "REVERSAL";
  merchantName: string;
  amountCents: number;
  currency: "CAD";
  cardLast4: string;
  createdAt: string;
  orderId?: string;
};
```

The core write should be a restricted Postgres function, tentatively named `post_mock_card_purchase`. It accepts a server-generated purchase request and performs locking, balance validation, order creation, ledger inserts, mock transaction creation, and inventory fulfillment in one transaction. The Next.js route invokes it with trusted server credentials after deriving the user and team from the session.

## Authorization model

| Viewer | Fund balance | Cards | Transactions |
|---|---|---|---|
| Active team participant | Their current team's fund | Their own active/revoked cards | Their own card's transactions; their team orders continue to follow existing team rules |
| Event Admin | Every team fund | Every card | Every transaction and ledger entry |
| Superadmin | Same as Admin, plus Admin-role management | Same as Admin | Same as Admin |

Enable RLS on all new public tables. Do not grant direct browser writes. Reads should be protected by active membership (`left_at is null`) and card ownership; protected write functions should be executable only by the service role unless a reviewed RLS-safe RPC is deliberately introduced.

## Implementation sequence

### 1. Add the simulator schema and atomic functions

- Create the five tables above, indexes, unique constraints, RLS policies, and immutable-ledger protections.
- Backfill each existing team's `available_cash_cents` into `team_funds` as an `INITIAL_FUNDING` ledger entry.
- Create one active mock card for each active team member.
- Replace current balance adjustments with ledger-backed fund adjustments.
- Update membership-admin functions so moving/removing a member revokes their old card and issues a new card only when appropriate.

### 2. Replace the checkout integration

- Rewrite `createOrder` so it calls the atomic mock-purchase function rather than creating a bill and synchronizing Ramp state.
- Return the mock transaction ID and updated shared balance from `POST /api/orders`.
- Fulfill inventory as part of the successful posted purchase.
- Preserve order invoices only if the event still wants a printable supplier receipt; they no longer represent a payable bill.

### 3. Build the mock-finance data API

- Implement the overview, current-card, transaction-list, and transaction-detail endpoints.
- Add cursor pagination and deterministic ordering for transaction feeds.
- Add Admin-only operations: fund a team, adjust a fund, freeze/unfreeze/revoke a card, create a declined/pending/reversed/refunded demo transaction.
- Define contract tests for insufficient funds, frozen cards, former members, concurrent purchases, and idempotent retries.

### 4. Connect the new UI

- Give the design team the stable endpoint contract above.
- Link supplier order confirmation to the transaction detail.
- Replace Ramp language in participant and Admin flows with “Workshop finance simulator” language.
- Display a clear workshop-only marker so participants do not mistake the interface for a live financial account.

### 5. Remove the Ramp implementation after mock checkout passes end-to-end

Only perform this deletion after a mock-card purchase can create an order, transaction, ledger entry, and inventory update in one transaction, and after the Admin funding/revocation flows work.

## Acceptance checks

1. Admin funding creates an auditable fund balance.
2. A valid card purchase creates exactly one order, transaction, ledger entry, and inventory update.
3. Retried or simultaneous purchases cannot duplicate charges or overspend the fund.
4. Former members and frozen cards cannot spend.
5. Participants can read only their own card transactions; Admins can read event-wide financial data.
