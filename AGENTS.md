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
- Supplier storefront, API routes, printable invoices, and Admin console live in one app.
- Supabase Postgres stores game state, inventory, team membership, Ramp mappings, and the durable webhook inbox.
- Supabase Auth provides email magic-link identity and sessions.
- Ramp Sandbox orders create drafts with attached PDF invoices so participants can review and submit them in Ramp.
- A signed webhook receiver records events in Supabase. An Admin can use the console’s manual Ramp reconciliation action to recover missed events until an automated reconciliation path is added.
- The event database owns fake cash, inventory, and game state. Ramp owns vendors, bills, approvals, and payment state.

## Common commands

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
npm run ramp:reconcile
```

The default local URL is `http://localhost:3000`.

## Authentication today

- Account creation and login use Supabase email magic links.
- Supabase owns user identity and session cookies; its email provider settings control delivery.
- Resend custom SMTP is configured in Supabase with `Socratica Bakery <login@socratica.info>` and the verified `socratica.info` sending domain. The project-wide Auth email limit is 30 emails per hour.
- Orders and invoices derive team membership from the authenticated session. Never trust a team ID supplied by the browser.

## Target authentication and team membership

Supabase Auth with email magic links is implemented. Account creation and authentication are separate from bakery-team membership:

1. A participant creates an account through Supabase Auth using an email magic link.
2. They join a bakery team only after account creation.
3. Teams have 3–6 participants. A user can have one active team per event; creation and joining use an invite link. Participants cannot leave, switch, delete, or merge teams themselves.
4. Active team members may rename their team and edit its submission until the deadline. The latest saved content freezes at the deadline.
5. Admins can adjust balances, reassign/remove participants, create invites, merge order-free teams, archive/delete eligible empty teams, and manually reconcile Ramp orders. Superadmins additionally manage Admin roles.

Supabase Auth owns user identity and sessions. The application owns bakery membership and authorization: derive team membership server-side, deny orders from users without a team, and scope all participant data to the authenticated user's assigned team.

## Ramp integration notes

- Use Ramp draft-bill endpoints for the workshop. The regular bill-creation endpoint auto-approves bills and bypasses the intended participant review step.
- Generate and attach a PDF invoice before participants submit the draft in Ramp. Ramp draft request amounts use major currency units; Ramp response amounts use cents.
- Only an authoritative Ramp bill with `status=PAID` and `status_summary=PAYMENT_COMPLETED` may fulfill inventory. A webhook is a signal to fetch and verify that bill, never sufficient evidence on its own.
- Webhook processing must be durable and idempotent. Save the verified event before returning success; a trusted reconciliation path fetches the provider bill before fulfillment. Reconciliation is the fallback for missed events.
- A local webhook test needs an HTTPS tunnel. Remove temporary subscriptions before closing the tunnel. The event needs a stable public URL; an Admin can manually reconcile while automated reconciliation is deferred.
- Ramp Sandbox's `pay current bill` demo action marks an eligible bill paid immediately. When Ramp requires scheduling first, schedule the fictional payment for today, then use the demo action. Do not use `Paid manually` for the participant-facing payment demonstration.
- Each event team needs an explicit `team_ramp_entities` mapping before it can create a Sandbox order. Never fall back to a shared default entity.

## Immediate next steps

1. Provision Ramp entities, participant roles, and entity-restricted Bill Pay access; run the two-team isolation test before the event.
2. Deploy a stable webhook endpoint and rehearse the full payment/reconciliation flow.
3. Improve magic-link inbox placement by configuring a branded Supabase Auth custom domain (for example, `auth.socratica.info`) and keeping the Auth template strictly transactional.
4. Add an automated reconciliation path only if manual Admin reconciliation is no longer sufficient.

## Security expectations

- Never commit API keys, OAuth tokens, webhook secrets, email-provider credentials, or production session secrets.
- Keep all provider credentials server-side in environment variables.
- Authentication codes and tokens must be short-lived, one-time where applicable, rate-limited, and stored securely according to the chosen provider's guidance.
- Use cryptographically secure randomness for application-managed tokens.
- Verify Ramp webhook signatures from the exact raw request bytes.
- Make payment fulfillment idempotent; webhook retries must not duplicate inventory.
- Scope all participant data access to the authenticated user's team.

## Implementation notes

- Apply Supabase schema changes through reviewed Supabase migrations and keep RLS enabled on public tables.
- Keep Ramp-specific calls behind `src/lib/ramp.ts` and trusted Supabase access behind `src/lib/supabase/`.
- Before modifying Next.js conventions, consult the versioned documentation in `node_modules/next/dist/docs/` as required by the generated rules above.
- Run both `npm run lint` and `npm run build` before handing off changes.
