# Mock finance API

The mock finance backend is a workshop-only local simulator. It does not connect to a payment network or accept real card details. All routes require a Supabase-authenticated session and derive the team and user from that session.

Amounts are integer cents. Currency is always `CAD`. Timestamps are ISO 8601 strings.

## Shared types

```ts
type CardStatus = "ACTIVE" | "FROZEN" | "REVOKED";
type TransactionStatus = "PENDING" | "POSTED" | "REVERSED" | "REFUNDED" | "DECLINED";
type TransactionType = "PURCHASE" | "REFUND" | "REVERSAL";

type Transaction = {
  id: string;
  status: TransactionStatus;
  type: TransactionType;
  amountCents: number;
  currency: "CAD";
  merchantName: string;
  createdAt: string;
  orderId: string | null;
  cardSuffix: string;
};
```

All error responses use:

```ts
{ error: string }
```

## `GET /api/mock-ramp/overview`

Returns the current participant's team fund, their most recently issued card, and their 10 newest transactions.

```ts
{
  fund: {
    availableCents: number;
    fundLimitCents: number;
    currency: "CAD";
    status: "ACTIVE" | "FROZEN";
    updatedAt: string;
  };
  card: {
    id: string;
    displayIdentifier: string; // e.g. "BAKE-81C3D20F"
    displaySuffix: string;     // four-character display suffix
    status: CardStatus;
    issuedAt: string;
  };
  transactions: Transaction[];
}
```

Returns `403` if the authenticated user has no active team membership. Returns `400` if the team fund or card has not been provisioned.

## `GET /api/mock-ramp/cards/me`

Returns only the authenticated participant's current display card.

```ts
{ card: { id: string; displayIdentifier: string; displaySuffix: string; status: CardStatus; issuedAt: string } }
```

## `GET /api/mock-ramp/transactions?limit=25`

Returns the authenticated participant's transactions newest first.

- `limit` is optional.
- Valid range: `1`–`100`.
- The default is `25`.
- The endpoint currently returns one bounded page; it does not implement cursor pagination.

```ts
{ transactions: Transaction[] }
```

## `GET /api/mock-ramp/transactions/:id`

Returns one transaction only when the authenticated participant owns its card.

```ts
{ transaction: Transaction }
```

Returns `404` for missing transactions and transactions belonging to another participant.

## `POST /api/orders`

Creates a supplier order and immediately posts a simulated card purchase. The backend calculates prices from the server-owned catalogue. The browser must never send an amount, team ID, card ID, or user ID.

### Headers

```text
Content-Type: application/json
Idempotency-Key: <UUID, recommended>
```

The idempotency key is scoped to the shared fund. Retrying an accepted request with the same key returns the original purchase rather than charging the fund twice.

### Request body

```ts
{
  vendorSlug: string; // registered active store slug
  items: Array<{
    productId: string;
    quantity: number; // integer 1–20
  }>;
}
```

`vendorSlug` chooses the store being checked out. It must be registered in the
deployment's server-side vendor registry; the browser never supplies the
merchant name or pricing. The purchase function resolves the registered vendor
again before posting the authorization and transaction, so the mock Ramp
activity is billed to that vendor.

### Success response: `201`

```ts
{
  id: string;              // order ID
  vendorSlug: string;      // registered vendor charged for this order
  invoiceNumber: string;
  totalCents: number;
  transactionId: string;
  availableCents: number;  // team fund balance after the purchase
  mode: "simulator";
}
```

### Failure behavior

- `401`: no authenticated session.
- `403`: no eligible active team.
- `400`: invalid item input, no active card, no active fund, insufficient balance, or another business-rule failure.

A declined purchase is recorded in the simulator. The checkout route returns `400` with the decline message and does not create an order or inventory rows.

## Admin operations

`POST /api/admin` requires an event Admin session.

### Set team fund limits

```ts
{
  action: "set_fund_limits";
  fundLimits: Array<{
    teamId: string;
    fundLimitCents: number;
  }>;
  reason?: string;
}
```

This updates every supplied team's total spend limit in one transaction. A change records an `ADMIN_ADJUSTMENT` ledger entry. Lowering a limit below prior spending results in a negative remaining balance and blocks new purchases.

Other existing Admin operations manage membership, teams, deadlines, and Admin roles. Card freeze/revoke/reissue and simulated refund/reversal controls are not yet exposed by this API.

## Design constraints

- Show `displayIdentifier` and `displaySuffix` as workshop-only visual identifiers, never as payment credentials.
- Show `fundLimitCents` as the team’s total spend limit and `availableCents` as its remaining balance. An Admin can lower a limit below prior spending, so remaining balance can be negative; new purchases remain declined until the balance covers the requested amount.
- Use transaction status and type verbatim for state-specific UI.
- Treat API IDs as opaque strings.
