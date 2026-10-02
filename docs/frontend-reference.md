# Frontend reference

This is a route-and-data map for visual-polish work. It deliberately separates
appearance from the server-side workshop rules so visual changes can be made
without weakening checkout, identity, or authorization behavior.

## Route families

| Surface | Routes | Layout and primary components |
| --- | --- | --- |
| Ramp participant experience | `/`, `/ramp`, `/ramp/expenses/[id]` | `src/app/(ramp)/layout.tsx`, `src/components/ramp/RampAppShell.tsx`, `RampHomeFeed`, `WalletPanel`, `CardDrawer`, and `ExpenseDetailView` |
| Admin console | `/admin` | `src/app/(ramp)/admin/page.tsx` loads the live data; `src/components/ramp/AdminTabs.tsx` renders teams, orders, products, and vendors |
| Storefront | `/store`, `/store/market`, `/store/market/[area]`, `/store/market/[area]/[product]`, `/store/cart`, `/store/receipt` | `src/app/(store)/layout.tsx`, `src/components/store/StoreHeader.tsx`, `ProductCard`, `ProductDetail`, `StoreCart`, `CheckoutView`, and `ReceiptView` |
| Workshop/team pages | `/teams/[id]`, `/submissions/[id]`, `/invoices/[id]` | `src/app/(bakery)/layout.tsx` plus the route-local page |

`/facilitator` is intentionally absent and should remain a 404.

## Styling and assets

- Shared non-Ramp styles live in `src/app/globals.css`.
- Ramp styles live in `src/app/(ramp)/ramp.css`.
- Store styles live in `src/app/(store)/store.css`.
- Static assets live under `public/ramp` and `public/store`. Product asset file
  names are data in the live catalogue; resolve them with
  `src/lib/store/product-assets.ts` instead of hard-coding per-product image
  paths in UI components.
- The store layout is the right place for shared header/cart visual changes. It
  already wraps every store route in `StoreCartProvider`.

## Live-data boundaries

- `src/lib/store/catalog-server.ts` is the single server-side source for
  active vendors and products. It uses a static fallback only when Supabase
  configuration is unavailable, for local/static-build resilience.
- Store cart state is client-side UI state in `src/components/store/StoreCart.tsx`;
  it is initialized and reconciled by `src/lib/store/cart-server.ts`.
- `/admin` is server-rendered from Supabase, then passes shaped data into the
  admin components. Product and vendor edits go through `/api/admin/products`
  and `/api/admin/vendors`.
- Participant finance screens read through `/api/mock-ramp/*`; do not replace
  those calls with browser-side Supabase access.

## Visual-change guardrails

- Keep checkout submission in `src/app/(store)/cart-actions.ts`. It posts line
  quantities only; prices, stock, team limits, and totals are authoritative in
  the database function.
- Preserve the distinction between a product being sold out and a team having
  reached its lifetime allowance. Both prevent a purchase, but they should be
  communicated differently in the interface.
- Mock card numbers and balances are workshop props. Do not add real card
  fields, payment-network integrations, manual balance edits, or card-revoke
  controls.
- Server-only code stays under `src/lib/supabase/` and must not be imported by
  Client Components.

## Useful verification loop

For pure visual work, start with `npm run dev` and inspect the route family you
changed. Before handoff, run `npm run lint` and `npm run build`. The Vinext
Cloudflare build is `npm run build:vinext`.
