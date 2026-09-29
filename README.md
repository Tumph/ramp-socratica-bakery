# Socratica Bakery Supply

A workshop prototype where bakery teams buy fictional wholesale supplies with individual workshop cards backed by one shared team fund. It has no connection to Ramp, a payment network, or a card processor.

## Architecture

- Next.js App Router with TypeScript.
- Supabase Auth provides magic-link sessions.
- Supabase Postgres stores teams, shared funds, nonfunctional mock cards, an append-only fund ledger, simulated transactions, orders, and inventory.
- Supplier checkout calls one atomic Postgres function that checks the signed-in member’s active mock card, deducts the shared fund, records the transaction and ledger entry, and fulfills inventory.
- Admins fund teams and manage membership; an Admin adjustment is recorded in the fund ledger.

## Commands

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

See [the simulator plan](./docs/mock-card-simulator-plan.md) for API contracts, data model, authorization, and acceptance checks.
