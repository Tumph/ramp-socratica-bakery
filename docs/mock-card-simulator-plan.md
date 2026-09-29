# Mock card-fund simulator: status and remaining work

## Implemented

- A team fund is the authoritative shared CAD balance.
- Active members receive a nonfunctional `BAKE-...` display card; the app stores no usable payment-card credentials.
- `post_mock_card_purchase` locks the fund, verifies the cardholder and active membership, creates the order, authorization, transaction, ledger entry, and inventory update in one transaction.
- Checkout has an idempotency key and uses server-owned catalogue prices.
- Admin balance changes use `admin_set_team_fund`, which writes an `ADMIN_ADJUSTMENT` ledger entry.
- The design-team data API exists:
  - `GET /api/mock-ramp/overview`
  - `GET /api/mock-ramp/cards/me`
  - `GET /api/mock-ramp/transactions?limit=...`
  - `GET /api/mock-ramp/transactions/:id`
- The supplier storefront posts an immediate local transaction and shows the remaining team-fund balance.
- Provider-specific runtime code, webhook handling, scripts, and example configuration have been removed.

## Remaining work

### Required before the event

1. **Run the end-to-end rehearsal.** Create a 3-person team, fund it, make a purchase, confirm the fund, ledger, transaction, order, and inventory values all agree, and confirm another member can spend from the same fund.
2. **Exercise failure cases.** Verify insufficient funds, repeated checkout submission, concurrent purchases, a removed member, and a frozen card. The current unit tests cover catalogue-derived prices and invalid item input; they do not exercise a live database purchase.
3. **Add the Admin card controls.** Admins can fund teams today. Add freeze/unfreeze, revoke, and reissue controls before attendees use the system.
4. **Build the participant finance screens.** The design team can use the API above to render the card, shared-fund balance, and personal transaction feed.

### Nice to have

- Add true cursor pagination to the transaction endpoint; it currently accepts a bounded `limit` and returns newest-first records.
- Add controlled demo operations for pending, declined, reversed, and refunded transactions.
- Link purchase confirmation to a transaction-detail page once the mock-finance UI exists.
- Add database-backed integration tests for the atomic purchase function.

## Later destructive cleanup

After the rehearsal passes, apply one reviewed Supabase migration that drops the old provider-integration tables, columns, functions, and indexes still preserved in the remote database. This is intentionally deferred because it is destructive and the current remote database retains that obsolete schema only as rollback protection.

## Security rules

- Never store a PAN, CVV, or expiry date.
- Never trust a browser-supplied amount, team ID, or card owner.
- Keep fund mutations in database functions that lock the fund row and write a ledger entry.
- Keep browser roles from writing simulator tables directly; use server routes with session-derived authorization.
