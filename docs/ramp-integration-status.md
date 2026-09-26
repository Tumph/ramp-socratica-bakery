# Sandbox integration test: September 25, 2026 (Toronto)

## Verified against Ramp Sandbox

- Client Credentials authentication and entity/vendor reads.
- Created fictional supplier `Socratica Bakery Supply (Sandbox Test)` (`b8d5e8e1-e395-4f06-a435-ab485b23ec22`). No vendor information emails requested.
- Used existing entity `Save Time Inc` (`a6ca1f96-fc93-4fd1-a34b-787ccc0af89a`) for a separate local Integration Test Bakery. No attendee accounts or new Ramp entities created; participant team mappings were not changed.
- Local order: `67805416-d432-498d-9c09-546836410a09`.
- Invoice: `SOC-67805416`, one tray of eggs, CAD 18.00.
- Ramp draft: `69b96aaf-3c5f-413e-9773-dd3857fa7770`.
- Draft GET confirmed entity, supplier, invoice number, CAD currency, and amount of 1800 cents. The initial test caught a units error: draft POST amounts are major units, whereas GET amounts are cents. The adapter and existing test draft were corrected before proceeding.
- Uploaded an INVOICE PDF, fetched the draft to confirm exactly one attachment, downloaded it back, and parsed its page count and invoice title.
- Re-running synchronization reused the draft and attachment.
- Registered and verified a temporary webhook subscription through a webhook-only HTTPS tunnel.
- Received Ramp-generated, signed `tests.test_event` `01a0db19-d58a-7b34-8790-2b44393871ce`; the durable inbox worker processed it successfully.
- Removed the temporary subscription after the transport test. A new stable/tunnel URL and verified subscription are needed for subsequent live webhook testing.

## Verified locally with simulated Ramp API responses

- Per-team routing and rejection of unmapped Sandbox orders.
- Correct cents/dollar conversion and valid invoice PDFs.
- Cash reservation retained after attachment failures; retry creates no second draft.
- Recovery after a lost draft creation response; uncertain outcomes never blindly re-create drafts.
- Draft-to-final-bill mapping; actual paid status required despite a webhook claiming payment.
- Missed-event reconciliation; duplicate processing does not duplicate inventory.
- Wrong entity/amount, invalid signatures, malformed payloads, and unexpected businesses fail safely.
- Mock mode works without external network calls.

## Not yet verified live

- Submission of the draft and routing through the intended human approval chain.
- Supplier/payment configuration for the selected entity and CAD payment method.
- Sandbox UI payment simulation and its actual `bills.paid` event.
- Paid-bill fulfillment using a real Ramp payment, rather than simulated API responses.
- Participant visibility restrictions across bakery entities (deferred by event organizer).

## Resume

The storefront remains in mock mode. In demo.ramp.com, open Bill Pay drafts and find `SOC-67805416`. Review it, configure required Sandbox contact/payment details, and submit through the intended approval workflow. Bring up the webhook receiver, register its public HTTPS URL, and run the worker before simulating payment. The Sandbox demo action's prerequisites depend on payment-release settings and user permissions.

Use `npx tsx scripts/ramp-order.ts sync 67805416-d432-498d-9c09-546836410a09` to reconcile this order; do not place a replacement test order. Reconciliation can recover payment even when the webhook was missed.

The event still needs a stable public endpoint, a continuously running worker, team permissions testing, production account provisioning, and a post-account-creation team-membership flow. Facilitator authentication is implemented. SQLite and the standalone development tunnel are local-prototype infrastructure.
