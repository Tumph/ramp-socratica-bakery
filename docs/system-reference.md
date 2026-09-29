# System reference

## Application

Socratica Bakery Supply is a Next.js workshop prototype. Bakery teams buy fictional supplies with individual workshop cards backed by one shared CAD fund.

The system is local to the event application. It has no payment-network connection and stores no real payment credentials.

## Identity and access

- Supabase Auth provides email magic-link sessions.
- The application derives active team membership from the authenticated session.
- A participant has one active team per event.
- Admin and Superadmin permissions are stored in `event_admins`.

## Team finance

- `team_funds` holds one spendable CAD balance per team.
- `mock_cards` holds one nonfunctional display card per active participant.
- `mock_authorizations` records purchase decisions.
- `mock_transactions` records visible purchase/refund/reversal activity.
- `fund_ledger_entries` is the immutable history of every fund change.

Supplier checkout calls `post_mock_card_purchase`. The function locks the fund row, checks active membership and card ownership, calculates the server-side catalogue total, and atomically writes the order, transaction, ledger entry, and inventory update.

## Routes

- `/` — supplier shop for an active team member.
- `/teams/:id` — team membership and submission workspace.
- `/admin` — event Admin console.
- `/api/orders` — supplier checkout.
- `/api/mock-ramp/*` — authenticated read API for the mock-finance UI. See [mock-finance-api.md](./mock-finance-api.md).

## Current limits

- The finance API returns bounded newest-first transaction lists; cursor pagination is not implemented.
- Admin funding is implemented. Admin controls for card lifecycle and simulated refunds/reversals are not implemented.
- The simulator schema has been deployed, but an end-to-end funded-team rehearsal has not yet been recorded.
- Obsolete integration tables remain in the remote database as temporary rollback protection; the application no longer uses them.
