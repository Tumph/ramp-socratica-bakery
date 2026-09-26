# Ramp Socratica Bakery

An event prototype where bakery teams order fictional supplies, review/pay matching Ramp Sandbox bills, and receive inventory only after Ramp confirms payment.

## Architecture

- Next.js App Router application with TypeScript.
- Supabase Postgres owns teams, membership, game cash, inventory, Ramp mappings, orders, and the durable webhook inbox.
- Supabase Auth provides email magic-link authentication. A signed-in account needs an Admin-assigned bakery team before it can order.
- Ramp owns vendors, bills, approvals, and payment state. The app verifies an authoritative Ramp bill before inventory is fulfilled.

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

`SUPABASE_SECRET_KEY` is server-only and must start with `sb_secret_`; never commit it or expose it with a `NEXT_PUBLIC_` name.

Open `http://localhost:3000`.

## What is implemented

- Supplier catalogue, cash reservation, invoices, and Ramp Sandbox draft creation
- Supabase magic-link authentication and server-side team authorization
- Supabase Row Level Security for participant-facing data
- Ramp Sandbox draft creation with attached PDF invoices
- Signed Ramp webhook inbox stored in Supabase
- Authoritative paid-bill verification and idempotent inventory fulfillment
- Admin-only order dashboard

## Ramp Sandbox

Configure `RAMP_CLIENT_ID`, `RAMP_CLIENT_SECRET`, and `RAMP_VENDOR_ID`. Each team must have an explicit record in `team_ramp_entities`; there is no shared fallback entity.

Configure Ramp to send bill events to:

```text
https://your-host/api/webhooks/ramp
```

The receiver validates Ramp’s signature over the raw request bytes, records the event durably, and never treats the webhook payload alone as proof of payment. For the workshop, an Admin can run a manual recovery pass from the Admin console when needed:

```bash
npm run ramp:reconcile
```

An automated scheduled reconciliation job is deliberately deferred; Vercel Hobby does not support frequent cron jobs. See [AGENTS.md](./AGENTS.md) for the operating rules and [PRD.md](./PRD.md) for the product proposal.

## Verification

```bash
npm run lint
npm run build
```

## Remaining event work

1. Configure production magic-link email delivery and an authenticated sending domain.
2. Define the Admin workflow for assigning participants to bakery teams.
3. Provision Ramp entities and entity-restricted participant permissions; run the two-team isolation test.
4. Add an automated scheduled reconciliation fallback before relying on webhooks unattended.
