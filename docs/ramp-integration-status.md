# Sandbox integration status: September 28, 2026

## Verified against Ramp Sandbox

- Client Credentials authentication plus entity/vendor reads.
- Created the fictional supplier `Socratica Bakery Supply (Sandbox Test)`.
- Created and re-read a draft with the expected entity, vendor, invoice number, CAD currency, and 1,800-cent amount.
- Attached and verified an invoice PDF.
- Registered a temporary signed webhook subscription and processed a Ramp-generated `tests.test_event`.

## Current implementation

- Supabase stores the order/Ramp snapshot and durable webhook inbox.
- The receiver validates raw-body signatures and records events before any provider read.
- A Ramp bill is fetched and validated against the saved entity, vendor, invoice, currency, amount, and draft mapping before inventory changes.
- Inventory fulfillment is idempotent.
- The Admin console's **Reconcile Ramp now** action is the current manual recovery tool for missed or delayed events; `npm run ramp:reconcile` is its local CLI equivalent.

## Still to verify live

- Submission through the human approval flow.
- Sandbox payment simulation and its `bills.paid` event.
- Paid-bill fulfillment using a real Sandbox payment.
- Participant visibility restrictions across entities.

## Verified supporting operations

- Supabase Auth uses Resend custom SMTP with the verified `socratica.info` domain and has successfully delivered a production magic link from `login@socratica.info`.
- The project-wide Supabase Auth email rate limit is set to 30 emails per hour.
- Inbox placement needs follow-up before the event: use a branded Supabase Auth custom domain for magic-link URLs and keep the Auth email template strictly transactional.

## Deferred operations work

There is no continuously running worker in the Vercel Hobby deployment model. During the workshop, monitor the Admin console and run its manual reconciliation action if an order remains pending. Add a scheduled service if unattended recovery becomes necessary.
