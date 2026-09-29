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

## Retirement inventory

### Delete application code and tests

| Path | Why it is removed |
|---|---|
| `src/lib/ramp.ts` | OAuth, Ramp API calls, vendor lookup, draft-bill creation, and invoice attachment are no longer used. |
| `src/lib/ramp-sync.ts` | Bill creation, verification, status mapping, and paid-bill fulfillment are replaced by the local atomic purchase function. |
| `src/lib/ramp-webhooks.ts` | The simulator does not receive provider webhooks. |
| `src/app/api/webhooks/ramp/route.ts` | Removes the provider webhook endpoint. |
| `tests/ramp-webhooks.test.ts` | Tests only the retired webhook-signature behavior. |
| `scripts/ramp-order.ts` | Retires CLI reconciliation. |
| `scripts/ramp-webhook-server.ts` | Retires local webhook testing. |
| `scripts/setup-ramp-supplier.ts` | Retires Sandbox supplier setup. |
| `scripts/setup-ramp-webhook.ts` | Retires webhook subscription setup. |
| `scripts/remove-ramp-webhook.ts` | Retires webhook teardown. |
| `docs/ramp-integration-status.md` | Superseded by simulator implementation/acceptance documentation. |

### Replace, not simply delete

| Current surface | Replacement |
|---|---|
| `src/lib/orders.ts` | Atomic local mock-card purchase implementation. |
| `src/app/api/orders/[id]/route.ts` | Return mock transaction data instead of `ramp_bill_id` and `ramp_status`. |
| `src/app/api/facilitator/orders/route.ts` | Return transaction/fund status instead of Ramp bill fields. |
| `src/app/api/admin/route.ts` | Remove `reconcile_ramp`; add fund/card simulator operations. |
| `src/components/Storefront.tsx` | Replace “Creating Ramp bill” and Ramp instructions with transaction confirmation. |
| `src/components/AdminConsole.tsx` | Replace “Reconcile Ramp now” with fund, card, and demo-transaction controls. |
| `src/components/FacilitatorOrders.tsx` | Show local transaction state and transaction reference. |
| `src/app/page.tsx` | Replace Ramp copy in checkout/product messaging. |
| `src/app/layout.tsx` | Update description and any remaining Ramp-specific terminology. |
| `src/app/invoices/[id]/page.tsx` | Keep as a fictional supplier receipt only if still useful; remove payment terms and Ramp framing. |
| `README.md`, `PRD.md`, `AGENTS.md`, `docs/codebase-audit.md` | Rewrite architecture, commands, product flow, known gaps, and next steps around the simulator. |
| `package.json` | Remove `ramp:reconcile` and `ramp:webhook-server` scripts. |

### Delete or migrate database objects through reviewed Supabase migrations

- `public.team_ramp_entities`
- `public.order_ramp_sync`
- Ramp-specific columns on `public.orders`, including `ramp_bill_id` and `ramp_status`
- `public.webhook_events`
- `public.ramp_webhook_challenges`
- `public.fulfill_paid_order(target_bill_id uuid)` and any Ramp-only triggers/functions
- Ramp-only constraints, indexes, RLS policies, and grants

Do not drop `orders`, `order_lines`, `inventory`, team membership, or team-submission data. They remain event-domain records and should be adapted to reference `mock_transactions`.

### Remove from deployment configuration

After application code no longer references them, remove these secrets and settings from local, Vercel, and Supabase environments:

```text
RAMP_API_BASE_URL
RAMP_CLIENT_ID
RAMP_CLIENT_SECRET
RAMP_SCOPES
RAMP_ACCESS_TOKEN
RAMP_VENDOR_ID
RAMP_WEBHOOK_SECRET
RAMP_BUSINESS_ID
RAMP_WEBHOOK_ID
RAMP_WEBHOOK_SETUP_TOKEN
RAMP_WEBHOOK_URL
```

Remove any external Ramp webhook subscription only after the application endpoint and local setup scripts have been retired.

## Acceptance checks

1. Admin funds a team and all active members receive a mock card.
2. A valid card purchase lowers the shared balance once, creates exactly one transaction and ledger entry set, creates an order, and adds inventory.
3. Retrying the same checkout request does not create another charge, order, or inventory increment.
4. Simultaneous purchases cannot reduce the fund below zero.
5. A declined purchase creates a declined transaction but no posted debit, order, or inventory.
6. A frozen, revoked, former-member, or wrong-team card cannot spend.
7. A refund/reversal restores the correct amount once and leaves an audit trail.
8. Participants cannot read another participant's card transactions; Admins can read all event data.
9. No deployed route, runtime code, script, test, environment variable, or participant-facing copy depends on Ramp.

## Sources informing the model

- Stripe Issuing distinguishes authorizations from settled transactions, including pending, closed, expired, and reversed authorization states: <https://docs.stripe.com/api/issuing/authorizations?lang++=curl>
- Stripe describes capture as releasing the authorization hold and creating a transaction that reduces balance: <https://docs.stripe.com/issuing/purchases/transactions>
- Supabase recommends database functions for data-intensive operations and documents secure function execution and RLS requirements: <https://supabase.com/docs/guides/database/functions> and <https://supabase.com/docs/guides/database/postgres/row-level-security>
