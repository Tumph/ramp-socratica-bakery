<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ramp Socratica Bakery project guide

## Product purpose

This repository contains an event prototype where teams pretend to run local bakeries. Participants order fake wholesale baking supplies, receive matching bills in Ramp Sandbox, review and pay those bills, and receive supplies in the event application after Ramp reports payment.

Read `PRD.md` for the complete product proposal and `README.md` for setup instructions.

## Current architecture

- Next.js App Router application with TypeScript.
- Supplier storefront, API routes, printable invoices, and facilitator console live in one app.
- SQLite through `better-sqlite3` is used for local prototyping.
- SQLite is not suitable for persistent Vercel deployment. Replace the database adapter with hosted Postgres, likely Supabase, before deployment.
- Ramp runs in mock mode by default. In Sandbox mode, orders create Ramp drafts with attached PDF invoices so participants can review and submit them in Ramp.
- A signed webhook receiver records events in SQLite. `npm run ramp:worker` fetches the authoritative Ramp bill before fulfilling an order and also reconciles unfinished orders every 15 seconds.
- The event database owns fake cash, inventory, and game state. Ramp owns vendors, bills, approvals, and payment state.

## Common commands

```bash
npm install
npm run db:init
npm run dev
npm test
npm run lint
npm run build
npm run ramp:worker
npm run ramp:reconcile
```

The default local URL is `http://localhost:3000`. The seeded development team code is `CROISSANT`.

## Authentication today

- Account creation uses email plus a facilitator-provided team code.
- Login uses email only.
- Both flows send a six-digit, one-time verification code.
- Codes expire after ten minutes, permit at most five attempts, are rate-limited, and are stored hashed rather than in plaintext.
- Successful verification creates a random, seven-day session token in an HTTP-only cookie. Only the token hash is stored in the database.
- `EMAIL_MODE=console` is development-only: the code is shown in the local UI and server output. It must never reveal codes in production.
- Orders and invoices derive team membership from the authenticated session. Never trust a team ID supplied by the browser.

## Confirmed authentication direction

Account creation will move from a reusable team code to a facilitator-issued magic invitation link for each attendee. Login will remain email plus a six-digit verification code. The current implementation still uses team codes until the invitation schema, mailer, and UI are built.

A proposed invitation flow is:

1. A facilitator creates an invitation for one email address and one team.
2. The system emails a short-lived magic link to that address.
3. Opening the link verifies the email, assigns the user to the intended team, consumes the invitation, and creates a session.
4. Reusing, modifying, revoking, or opening an expired invitation must fail safely.

Use an opaque cryptographically random invitation token stored only as a hash. It is simpler to invalidate than a JWT and must be short-lived, single-use, and revocable.

## Ramp integration notes

- Use Ramp draft-bill endpoints for the workshop. The regular bill-creation endpoint auto-approves bills and bypasses the intended participant review step.
- Generate and attach a PDF invoice before participants submit the draft in Ramp. Ramp draft request amounts use major currency units; Ramp response amounts use cents.
- Only an authoritative Ramp bill with `status=PAID` and `status_summary=PAYMENT_COMPLETED` may fulfill inventory. A webhook is a signal to fetch and verify that bill, never sufficient evidence on its own.
- Webhook processing must be durable and idempotent. Save the verified event before returning success; the worker handles provider reads and retries. Reconciliation is the fallback for missed events.
- A local webhook test needs an HTTPS tunnel. Remove temporary subscriptions before closing the tunnel. The event requires a stable public URL and continuously running worker.
- Ramp Sandbox's `pay current bill` demo action marks an eligible bill paid immediately. When Ramp requires scheduling first, schedule the fictional payment for today, then use the demo action. Do not use `Paid manually` for the participant-facing payment demonstration.
- Each event team needs an explicit `team_ramp_entities` mapping before it can create a Sandbox order. Never fall back to a shared default entity.

## Immediate next steps

1. Connect a real transactional email provider. Brevo is currently the leading option because its free tier permits 300 emails per day; Resend is the leading developer-experience alternative but has a 100-email daily free limit.
2. Authenticate a dedicated sending subdomain owned by the event, such as `auth.example.com`, using the provider's SPF, DKIM, and DMARC instructions.
3. Add a production mailer adapter while preserving the console adapter for local development.
4. Replace team-code signup with per-user magic invitations and a production mailer.
5. Protect the facilitator UI and APIs with an explicit facilitator/admin role.
6. Provision Ramp entities, participant roles, and entity-restricted Bill Pay access; run the two-team isolation test before the event.
7. Deploy a stable webhook endpoint and worker, then replace SQLite with hosted Postgres before deploying to Vercel.

## Security expectations

- Never commit API keys, OAuth tokens, webhook secrets, email-provider credentials, or production session secrets.
- Keep all provider credentials server-side in environment variables.
- Verification codes and magic-link tokens must be short-lived, one-time, rate-limited, and stored only as hashes.
- Use cryptographically secure randomness for codes, sessions, and invitations.
- Keep authentication responses and logs free of verification codes in production.
- Verify Ramp webhook signatures from the exact raw request bytes.
- Make payment fulfillment idempotent; webhook retries must not duplicate inventory.
- Scope all participant data access to the authenticated user's team.

## Implementation notes

- Run `npm run db:init` after changing `sql/schema.sql`. Schema creation should remain idempotent.
- Keep Ramp-specific calls behind `src/lib/ramp.ts` and database access behind `src/lib/db.ts` so providers can be swapped cleanly.
- Treat mock mode as a supported local development path.
- Before modifying Next.js conventions, consult the versioned documentation in `node_modules/next/dist/docs/` as required by the generated rules above.
- Run both `npm run lint` and `npm run build` before handing off changes.
