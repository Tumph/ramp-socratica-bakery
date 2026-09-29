# Codebase audit

## Current architecture

The application is a Next.js event prototype backed by Supabase Auth and Postgres. It simulates team finances locally: each team has one shared CAD fund, active participants have nonfunctional workshop cards, and supplier checkout creates a local transaction and inventory fulfillment.

The simulator never stores usable payment credentials and has no connection to a payment network or third-party financial API.

## Confirmed safeguards

- Magic-link authentication is owned by Supabase Auth.
- Team membership is derived server-side from the session.
- Mock-card tables have RLS enabled and browser roles have no direct table privileges.
- `post_mock_card_purchase` locks the shared fund, verifies the active cardholder, creates the order, transaction, and immutable ledger entry, and fulfills inventory in one database transaction.
- Checkout includes a client idempotency key; the database constrains idempotency per fund.

## Remaining work

- Run a full event rehearsal with a funded team and at least two simultaneous purchase attempts.
- Add explicit Admin controls for card freeze/unfreeze and simulated refunds/reversals.
- Add participant-facing mock-finance pages using the `/api/mock-ramp/*` contract.
- After successful rehearsal, apply a reviewed destructive migration that drops obsolete integration tables and columns still retained in the remote database.
