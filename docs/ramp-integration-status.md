# Sandbox integration status: September 28, 2026

## Previously verified against Ramp Sandbox

- Client Credentials authentication plus entity/vendor reads.
- Created the fictional supplier `Socratica Bakery Supply (Sandbox Test)`.
- Created and re-read a draft with the expected entity, vendor, invoice number, CAD currency, and 1,800-cent amount.
- Attached and verified an invoice PDF.
- Registered a temporary signed webhook subscription and processed a Ramp-generated `tests.test_event`.

## Current implementation

- Supabase stores the order/Ramp snapshot and durable webhook inbox.
- The receiver validates raw-body signatures and records supported events. It makes no provider reads and does not initiate fulfillment.
- A Ramp bill is fetched and validated against the saved entity, vendor, invoice, currency, amount, and draft mapping before inventory changes.
- Read-only inspection of live Supabase confirms that fulfillment locks the order and updates inventory/status atomically and idempotently.
- The Admin console's **Reconcile Ramp now** action is the current payment-processing/recovery path. The local CLI command is `npm run ramp:reconcile`; it scans all unfinished orders, while the Admin action is scoped to the configured event. Neither updates webhook inbox processing markers.

## Still to verify live

- Submission through the human approval flow.
- Sandbox payment simulation and its `bills.paid` event.
- Paid-bill fulfillment using a real Sandbox payment.
- Participant visibility restrictions across entities.

## Previously verified supporting operations

These are the recorded September 28 checks. The codebase audit did not recheck live SMTP, DNS, delivery, or Auth rate-limit settings.

- Supabase Auth uses Resend custom SMTP with the verified `socratica.info` domain and has successfully delivered a production magic link from `login@socratica.info`.
- The project-wide Supabase Auth email rate limit is set to 30 emails per hour.
- Inbox placement needs follow-up before the event: use a branded Supabase Auth custom domain for magic-link URLs and keep the Auth email template strictly transactional.

## Deferred operations work

Stable webhook deployment and automatic processing of received events are planned. There is no worker or scheduled reconciliation job configured yet. Vercel deployment is planned separately; this document does not confirm a deployed endpoint. During the workshop, an Admin must reconcile to advance paid orders into inventory. Add a scheduled service if unattended operation becomes necessary.

Live Ramp payment/isolation rehearsal is paused while the demo site has issues. Prior checks above have not been repeated during this audit. See [the codebase audit](./codebase-audit.md) for current code/database gaps.
