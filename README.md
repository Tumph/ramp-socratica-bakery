# Ramp Socratica Bakery

A working prototype of the bakery Bill Pay workshop. Teams order fake wholesale supplies, the app creates a Ramp Sandbox draft with a PDF invoice, and a verified paid bill fulfills the order into the team's game inventory.

The app runs in mock mode by default, so the complete order-to-fulfillment loop can be tested without Ramp credentials.

See [PRD.md](./PRD.md) for the full product and event architecture.

## Local setup

```bash
cp .env.example .env.local
npm install
npm run db:init
npm run dev
```

Open `http://localhost:3000`. The seeded team starts with CAD $1,000 of fake cash.

## What is implemented

- Supplier catalogue and purchase-order flow
- Passwordless signup and login with email verification codes
- Team-code assignment during signup
- Hashed one-time codes and HTTP-only sessions
- File-backed SQLite database
- Fake-cash reservation when an order is placed
- Printable HTML invoices and downloadable PDF invoices
- Mock Ramp bill creation and payment
- Ramp Sandbox draft creation and invoice attachment
- Signed webhook inbox, background processing, and reconciliation
- Idempotent inventory fulfillment
- Facilitator order dashboard

## Mock versus Ramp Sandbox

`RAMP_MODE=mock` creates a local mock bill and displays a button that simulates a paid bill. No external service is called.

`EMAIL_MODE=console` is the development mailer. Verification codes appear in the UI and server console only outside production. The seeded signup team code is `CROISSANT`. A real email provider must be connected before deployment.

The current signup UI still uses a team code. The confirmed product direction is one facilitator-issued, revocable magic invitation link per attendee; login will continue using email plus a verification code. See [AGENTS.md](./AGENTS.md) for the invitation requirements.

For the Sandbox adapter, configure `.env.local`:

1. In your Sandbox developer app, enable the **Client Credentials** grant and scopes `bills:read bills:write entities:read vendors:read`.
2. Set `RAMP_CLIENT_ID` and `RAMP_CLIENT_SECRET` from that app. Keep `RAMP_API_BASE_URL=https://demo-api.ramp.com` and leave `RAMP_ACCESS_TOKEN` blank. The server exchanges credentials for a token and caches it in memory until shortly before expiry. An explicit `RAMP_ACCESS_TOKEN` overrides this exchange.
3. Set `RAMP_VENDOR_ID` to the supplier vendor ID in that Sandbox business. Buying entities are mapped per team in SQLite using the two-team setup below. `RAMP_ENTITY_ID` is no longer used; unmapped teams cannot submit Sandbox orders. Entities and vendors can be looked up through `GET /developer/v1/entities` and `GET /developer/v1/vendors`.
4. Set `RAMP_MODE=sandbox` and restart the development server once those values are ready.
5. When configuring the webhook subscription, set `RAMP_WEBHOOK_SECRET` to its signing secret, not your client secret.

The app creates drafts without scheduling payments. Participants review the draft, select valid Sandbox vendor contact/payment details, submit it, and follow the configured approval workflow in Ramp. Client Credentials is appropriate for this single-business internal test; integration with other businesses requires the Authorization Code flow. See [Ramp authorization documentation](https://docs.ramp.com/developer-api/v1/authorization).

The adapter deliberately uses draft endpoints: the regular bill-creation endpoint auto-approves bills and does not provide the intended workshop review step. Amounts and PDFs use CAD throughout; draft line-item inputs are decimal dollar strings, while Ramp responses are checked in cents. See [Ramp bill-payment documentation](https://docs.ramp.com/developer-api/v1/bill-payments).

## SQLite and Vercel

SQLite is intentionally used for the local prototype. A database file is not durable on Vercel's serverless filesystem, so deployment will require replacing `src/lib/db.ts` with a hosted database adapter such as Supabase/Postgres. The rest of the application boundaries are designed to survive that swap.

## Ramp webhook

Configure Ramp to send `bills.paid` events to:

```text
https://your-host/api/webhooks/ramp
```

The receiver verifies the signature over the exact raw bytes and validates `RAMP_BUSINESS_ID`, then saves the event in SQLite before acknowledging it. It does not fulfill orders in the HTTP request.

Run `npm run ramp:worker` alongside the app. It processes the durable inbox and reconciles unfinished Sandbox orders every 15 seconds. It fetches the actual Ramp bill and checks invoice number, entity, vendor, CAD amount, and draft mapping before fulfilling a fully paid bill. Repeated events and polling cannot add inventory twice. `npm run ramp:reconcile` performs one manual reconciliation pass.

For a local webhook test:

1. Run `npm run ramp:webhook-server` (127.0.0.1:3901, webhook route only).
2. Run `cloudflared tunnel --url http://127.0.0.1:3901` or configure another HTTPS tunnel to this port.
3. Run `npx tsx scripts/setup-ramp-webhook.ts https://YOUR-HOST/api/webhooks/ramp`. It saves the secret, business ID, subscription ID and a separate random setup header in `.env.local`, captures the challenge, and verifies the subscription. Restart the Next.js server to load new settings; the standalone webhook server reloads its webhook settings for setup.
4. Run the worker. Use `tests.test_event` to test signed transport; this is not proof of a paid bill.
5. Before closing a temporary tunnel, run `npx tsx scripts/remove-ramp-webhook.ts`. It deletes only the configured subscription and clears its local settings. Keep a stable public URL and worker running for the event.

The setup header authenticates verification challenges only, never business events. See [Ramp webhook documentation](https://docs.ramp.com/developer-api/v1/webhooks).

## Recovery and single-team integration test

`npx tsx scripts/setup-ramp-supplier.ts` creates or reuses the fictional Sandbox supplier. It requests `vendors:write` for that setup call and does not request emails to the vendor.

`npx tsx scripts/ramp-order.ts test <existing-entity-id>` creates a separate local Integration Test Bakery and a CAD 18.00 egg order. It reuses its existing order on subsequent runs, so the normal participant team mappings remain untouched. It creates no Ramp entities or attendee accounts.

`npx tsx scripts/ramp-order.ts sync <order-id>` recovers a saved order and retries a missing attachment. The order's entity/vendor mapping is snapshotted before the first network write. Draft-creation intent is recorded before POST; after a lost response, recovery searches by the exact invoice, entity, and vendor. An uncertain write with no visible match requires manual inspection rather than blind recreation. A database lease prevents ordinary concurrent recovery attempts. Do not reset this state while an API request may still be running.

An integration error keeps the order and its cash reservation; the storefront tells the participant not to reorder. Rejected or archived bills also retain their reservation pending facilitator review: automated cancellation/refunds are not implemented. Orders created by older versions without an integration snapshot need manual review. Do not delete orders or reset balances to recover a timeout.

The facilitator console remains unprotected and is read-only. Recovery runs from the local CLI; no public admin mutation endpoints were added.

## Two-team Sandbox isolation test

1. In the Sandbox UI, create Croissant Bakery and Sourdough Bakery entities. The public Business Entities API documents listing and reading entities, not creating them. If entity creation or entity restrictions are unavailable, ask Ramp to enable/provision the Sandbox features.
2. Run `npm run db:init`, then `node scripts/map-ramp-teams.mjs <croissant-entity-uuid> <sourdough-entity-uuid>`. This verifies both entities through the Sandbox API and maps each to its own local team. Existing cash and orders are preserved. The second team's temporary local signup code is `SOURDOUGH`; invitation signup remains a separate planned change.
3. Invite two test attendees to Ramp, one per entity, using locations mapped to those entities. Give each an Employee base role and the required Accounts Payable permissions restricted to only their entity under Bill Pay settings. Do not use Admin/Owner accounts to test isolation. A bakery-app login does not create a Ramp login.
4. Configure entity-specific approval routing and the supplier vendor's default contact/payment method. Set `RAMP_VENDOR_ID`, then enable `RAMP_MODE=sandbox` and restart the app.
5. Place one small order as each bakery-app user. Confirm each resulting bill has the expected entity in Ramp. Review and submit the draft in Ramp, then verify the configured approval routing.
6. In separate browser profiles, sign in as the two Ramp test users. Check bill lists, search, and direct links to the other team's bill. Verify each can perform their assigned actions on their own bill and cannot view or edit the other team's bill. Also check vendor visibility and any additional roles that could broaden access.
7. Test Sandbox payment simulation and signed webhook fulfillment separately. Confirm inventory is added only to the paying team, and duplicate delivery has no effect.

Do not consider Ramp access isolation verified until step 6 passes with actual participant sessions. The shared API token sees across entities and cannot prove participant restrictions. Record results for both users before provisioning all attendees.

Local regression checks: `npm test`, `npm run lint`, and `npm run build`.
