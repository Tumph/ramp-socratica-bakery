# Ramp Socratica Bakery

An event prototype where bakery teams order fictional supplies, review/pay matching Ramp Sandbox bills, and receive inventory after an Admin reconciles a verified payment.

## Architecture

- Next.js App Router application with TypeScript.
- Supabase Postgres owns teams, membership, game cash, inventory, Ramp mappings, orders, and the durable webhook inbox. There is no SQLite runtime.
- Supabase Auth provides email magic-link authentication. After signing in, participants create a team or join an open team; Admin assignment is also available.
- Ramp integration uses one configured Sandbox business and supplier, with an explicit entity mapping for each team. Multi-business credentials are not implemented.
- Ramp owns vendors, bills, approvals, and payment state. The app fetches and validates the authoritative bill before inventory fulfillment.
- The webhook receiver is implemented; stable deployment and an automatic event-processing path are planned. Currently, receiving an event records it without triggering delivery. The Admin console and CLI reconcile orders on demand.

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set these required Supabase values in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Use the project's modern `sb_secret_` key for `SUPABASE_SECRET_KEY`. It is server-only; never commit it or expose it with a `NEXT_PUBLIC_` name.

Open `http://localhost:3000`.

### Database setup and migration history

The app connects to a provisioned Supabase project; `npm install` and `npm run dev` do not create or migrate a database. The app currently uses the event ID defined in `src/lib/auth.ts`.

`supabase/migrations/` contains Postgres changes for Admin operations, Admin roles, and the submission-media bucket. These are **not SQLite migrations** and are only a partial copy of the live Supabase migration history. The base schema, membership/RLS setup, bootstrap setup, and atomic fulfillment function were applied remotely and are not checked in. Local version timestamps also differ from the corresponding remote versions. Do not blindly replay these files against the existing project or treat them as a complete fresh-project setup.

See [the codebase audit](./docs/codebase-audit.md) for the read-only database findings and outstanding history synchronization work.

## Auth email delivery

The September 28 operations record reports Resend custom SMTP, verified sending-domain records, and successful magic-link delivery from `Socratica Bakery <login@socratica.info>`. It records a **30-email-per-hour project-wide Auth limit**. Those dashboard settings are external to this repository and were not rechecked by the codebase audit.

Auth delivery is configured in **Supabase Dashboard → Authentication → SMTP**. The application does not send email directly; SMTP credentials and Resend API keys are not needed in `.env.local`.

Inbox placement and event arrival capacity still need verification. The operations plan proposes a branded Supabase Auth domain such as `auth.socratica.info` and a strictly transactional Auth template.

## Implemented behavior

- Supplier catalogue, available-cash deduction at order creation, printable/downloadable invoices, and Ramp draft creation with attached PDFs
- Magic-link authentication, self-service team creation, and an authenticated directory of open teams
- One active team per participant per event, with a serialized database team-size check; teams may have fewer than three members while forming
- Shop access after the submission deadline for teams with at least three active members and a submission row
- Project title, tagline, plain-text write-up, typed links, images, and public project pages with stable IDs
- Submission and image endpoints reject edits after the deadline
- Admin controls for balances, membership reassignment/removal, order-free team merges, empty-team soft deletion, deadlines, and reconciliation; Superadmins manage Admin roles
- Signed webhook storage and authoritative bill validation during manual reconciliation
- Atomic, idempotent inventory fulfillment in Supabase

Known gaps include concurrent cash reservation, rejected-order refunds, and team-name deadline enforcement. These are recorded in [the audit](./docs/codebase-audit.md); the feature list does not imply they are solved.

## Ramp Sandbox

Configure `RAMP_CLIENT_ID`, `RAMP_CLIENT_SECRET`, and `RAMP_VENDOR_ID`. Each team needs an explicit `team_ramp_entities` record; there is no shared fallback entity. New teams start with zero cash, so an Admin must allocate their balance.

The webhook route is:

```text
https://your-host/api/webhooks/ramp
```

The receiver validates Ramp's signature over the raw request bytes and saves supported events durably. It does not fetch bills, fulfill orders, or update inbox processing markers. Use **Reconcile Ramp now** in the Admin console or:

```bash
npm run ramp:reconcile
```

The Admin action checks unfinished orders in the configured event. The CLI checks all unfinished orders in the connected database. Both can recover draft/attachment setup and fulfill a matching bill only when Ramp returns `PAID` and `PAYMENT_COMPLETED`.

Useful local operations scripts:

```bash
npm run ramp:webhook-server
npx tsx scripts/setup-ramp-supplier.ts
npx tsx scripts/setup-ramp-webhook.ts https://your-host/api/webhooks/ramp
npx tsx scripts/remove-ramp-webhook.ts
```

The webhook-only server listens on `127.0.0.1:3901`. Setup/removal scripts change Sandbox resources and local environment configuration; remove temporary subscriptions before closing a development tunnel. Automatic webhook processing is planned alongside stable deployment. No worker or scheduled reconciliation job is configured yet.

## Verification

```bash
npm test
npm run lint
npm run build
```

The current test suite covers raw-byte webhook signature validation. It does not test authentication, authorization, database concurrency, refunds, or full Ramp fulfillment.

## Remaining work

The [audit](./docs/codebase-audit.md) lists confirmed code and database gaps. The [integration status](./docs/ramp-integration-status.md) distinguishes past live checks from unfinished verification. [PRD.md](./PRD.md) contains current behavior plus explicitly proposed workshop requirements.

Ramp permissions/isolation rehearsal is paused while the demo site has issues. Stable webhook deployment will be handled separately with the planned Vercel setup. Automated reconciliation remains deferred until unattended operation is needed.
