# System reference

## Application

Socratica Bakery Supply is a Next.js workshop prototype. Bakery teams buy fictional supplies with individual workshop cards backed by one shared CAD fund.

The system is local to the event application. It has no payment-network connection and stores no real payment credentials.

## Identity and access

- Supabase Auth provides email magic-link sessions.
- The application derives active team membership from the authenticated session.
- An Admin creates teams and emails team-bound, one-time invitation links. The link signs in its recipient and adds that recipient email to the selected team. Participants cannot create, browse, choose, leave, or switch teams themselves.
- A participant has one active team per event. Teams are limited to six active participants and need three to be eligible to shop.
- Admin and Superadmin permissions are stored in `event_admins`.

## Team finance

- `team_funds` holds one CAD fund limit and remaining balance per team. An Admin can lower a limit below prior spending, resulting in a negative remaining balance that blocks new purchases.
- `mock_cards` holds one nonfunctional display card per active participant.
- `vendors` is the trusted registry of simulated merchants. Each storefront has
  a stable slug and is billed under its own vendor display name.
- `mock_authorizations` records purchase decisions, including the registered
  vendor name used for the decision.
- `mock_transactions` records visible purchase/refund/reversal activity.
- `fund_ledger_entries` is the immutable history of every fund change.

Supplier checkout calls `post_mixed_store_checkout`. The function locks the shared fund once, checks idempotency, resolves active registered vendors and their server-side product prices, checks active membership and card ownership, then atomically writes one vendor-attributed order, transaction, and ledger entry per vendor while decrementing inventory.

## Routes

- `/` — account landing page while storefronts are being redesigned.
- `/teams/:id` — team membership and submission workspace.
- `/admin` — event Admin console.
- `/api/orders` — supplier checkout.
- `/api/mock-ramp/*` — authenticated read API for the mock-finance UI. See [mock-finance-api.md](./mock-finance-api.md).

## Current limits

- The finance API returns bounded newest-first transaction lists; cursor pagination is not implemented.
- Admins can edit all active-team fund limits together. Card lifecycle and simulated refund/reversal controls are not implemented.
- The simulator schema has been deployed, but an end-to-end funded-team rehearsal has not yet been recorded.
- The Admin console sends individual team invitations. CSV import with validation and preview is a planned event-setup improvement.
- Supabase Auth must allow the deployed callback URL with an `invite` query parameter (for example, `https://app.example.com/auth/callback*`) before invitations can be sent from that origin.
- Obsolete integration tables remain in the remote database as temporary rollback protection; the application no longer uses them.
