# PRD: Socratica Bakery workshop card simulator

Teams run fictional bakeries during an event. Each team receives a shared CAD workshop fund, and every active participant receives a nonfunctional display card. Supplier purchases immediately create local simulated transactions and deliver inventory.

The application is not connected to Ramp, a payment network, or a card processor. Card identifiers are workshop-only display values; no PAN, CVV, or usable payment credential is stored.

## Core flow

1. An Admin funds a team.
2. Team members receive mock cards linked to the same fund.
3. A member purchases supplies.
4. The server validates card ownership and team membership, calculates the catalogue total, atomically posts a transaction, deducts the fund, and adds inventory.
5. The participant sees the transaction; the team sees the remaining shared balance.

## Rules

- Teams have 3–6 participants.
- A participant can belong to one active team.
- Each active team member has one active mock card.
- The shared fund is the only spendable balance.
- Every balance change has an immutable ledger entry.
- Checkout retries are idempotent and concurrent purchases cannot overspend.

The detailed design, data model, API contract, migration path, and acceptance tests are in [docs/mock-card-simulator-plan.md](./docs/mock-card-simulator-plan.md).
