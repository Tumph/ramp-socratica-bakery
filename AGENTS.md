<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Socratica Bakery project guide

## Product purpose

This repository contains an event prototype where bakery teams buy fictional wholesale supplies with workshop-only cards connected to one shared team fund. It has no connection to a payment network or external financial API.

## Current architecture

- Next.js App Router application with TypeScript.
- Supplier storefront, printable receipts, and Admin console live in one app.
- Supabase Postgres stores team membership, shared funds, nonfunctional mock cards, local transactions, immutable ledger entries, orders, and inventory.
- Supabase Auth provides email magic-link identity and sessions.
- Supplier checkout runs an atomic local purchase function: it validates the active cardholder, deducts the shared fund, records the transaction, and fulfills inventory.

## Common commands

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

The default local URL is `http://localhost:3000`.

## Authentication and team membership

Supabase Auth owns user identity and sessions. The application owns bakery membership and authorization:

1. Participants sign in with a magic link.
2. They create or join one bakery team.
3. Teams have 3–6 participants. Participants cannot leave or switch teams themselves.
4. Active team members may rename their team and edit its submission before the deadline.
5. Admins adjust shared funds, reassign/remove participants, merge order-free teams, archive eligible empty teams, and manage the event deadline. Superadmins additionally manage Admin roles.

## Workshop-finance rules

- Every active team has one shared CAD fund.
- Every active member receives one nonfunctional mock card. Store only display identifiers such as `BAKE-...`; never store a PAN, CVV, or expiry date.
- Checkout totals are calculated server-side from the catalogue.
- All fund changes must create an immutable ledger entry.
- The purchase function must remain atomic and idempotent: lock the fund before spending and never trust browser-supplied totals.
- Card, fund, transaction, and ledger reads go through trusted application APIs; do not grant browser roles direct write access.

## Implementation notes

- Apply Supabase schema changes through reviewed migrations and keep RLS enabled on public tables.
- Keep trusted Supabase access behind `src/lib/supabase/`.
- The current architecture is in `docs/system-reference.md`; the frontend API contract is in `docs/mock-finance-api.md`.
- Before modifying Next.js conventions, consult the versioned documentation in `node_modules/next/dist/docs/` as required by the generated rules above.
- Run both `npm run lint` and `npm run build` before handing off changes.
