# Codebase audit — September 28, 2026

## Scope and evidence

Reviewed all tracked application routes/pages, components, libraries, scripts, configuration, tests, dependencies, and project documentation. Traced static/dynamic imports and runtime entry points, checked export references and CSS selectors, and ran TypeScript unused-symbol checks. Queried the connected Supabase project's migration list, public/private function definitions, triggers, constraints, indexes, function execution permissions, and RLS policies read-only. No live database or provider configuration was changed. No participant records, credentials, or tokens are included here.

Ramp live payment/visibility rehearsal is paused while its demo site has issues. Stable webhook deployment on Vercel and automatic webhook processing remain planned. DNS/SMTP/Auth email limits and live Ramp behavior were not reverified; historical checks are labeled as such.

## Supabase versus SQLite

SQLite's `src/lib/db.ts`, `sql/schema.sql`, initialization/mapping scripts, local payment mock, and worker were deleted in commit `6fd6c03` (migration to Supabase). The current runtime has no SQLite imports or dependency. Historical database patterns in `.gitignore` remain to avoid accidentally committing old local data.

Local SQL files are Supabase Postgres changes, not SQLite remnants:

| Change | Local version | Applied Supabase version |
| --- | --- | --- |
| Admin operations | `20260926071955` | `20260926072112` |
| Admin roles | `20260926072125` | `20260926072405` |
| Submission media | `20260926074356` | `20260926074405` |

Supabase additionally reports `create_bakery_schema` (`20260926041626`), `make_paid_fulfillment_atomic` (`20260926044129`), `add_event_teams_and_submissions` (`20260926062914`), and `add_superadmin_bootstrap` (`20260926063934`). Their migration files are not in the repo. The table above matches names/purpose, not a byte-for-byte SQL comparison.

The live database already has the base schema, fulfillment function, RLS, and membership protections. The local folder is an incomplete, differently versioned history; it cannot recreate that project by itself. Preserve these files until a deliberate history synchronization/bootstrap task accounts for the applied versions. Do not replay or rename them casually.

Confirmed live protections:

- RLS enabled on all 18 public tables.
- A partial unique index on `(event_id, user_id)` where `left_at IS NULL` enforces one active team per event.
- `private.enforce_team_size` checks active member count before membership inserts/reactivation/moves.
- `public.fulfill_paid_order` locks the matching order, checks for prior fulfillment, adds inventory, and updates order status atomically. `anon` and `authenticated` have no execution permission.
- Team/bill/draft/invoice uniqueness constraints and nonnegative cash/quantity checks exist.

## Cleanup performed

- Removed the unused `processRampWebhookInbox` export and its sole helper, `reconcileRampBill`. Neither had a runtime/script caller. These were inactive scaffolding, not a deployed processing path. The signed receiver, durable inbox, webhook setup/removal scripts, bill verification, and order reconciliation remain. Automatic processing remains planned and will need an actual execution entry point.
- Removed `/api/auth/verify`, a legacy code-auth stub that only returned HTTP 410. Current authentication uses email links and `/auth/callback`; no repository caller used the stub.
- Removed unused login-tab/code-input CSS and an obsolete confirmation-button selector. Renamed still-used helper/invite styles to describe their current purposes.
- Corrected the login confirmation copy: participants can create/join teams themselves after authentication.
- Declared `@next/env` directly at the already locked `16.3.5` version. All five operations scripts import it; it previously worked through Next.js's transitive dependency.
- Consolidated duplicate auth imports and replaced obsolete worker/console-email comments.
- Updated README, PRD, AGENTS, and integration status to separate implementation, intended rules, planned deployment, and historical provider checks.

No declared package was unused. `react-dom` is required by Next.js even without a direct application import; TypeScript, type packages, ESLint/config, and `tsx` support the framework/checks/scripts. Every retained application module is reachable from framework entry points or another module. Standalone operations scripts are valid entry points even when not imported or exposed as npm scripts.

Retained names/routes with current callers:

- `/api/auth/request-code` now sends a magic link; `AuthFlow` calls it. Its name is historical, but it is active.
- `/facilitator` implements the Admin console and `/admin` exports that page. `FacilitatorOrders` calls `/api/facilitator/orders`. These are active aliases/components, not dead facilitator-auth code.
- `.env.example` documents active receiver/setup configuration. No Resend dependency or application email sender exists because Supabase owns Auth email delivery.

## Claims corrected

| Previous implication | Observed behavior |
| --- | --- |
| Accounts require Admin-assigned teams | Participants create/join teams; Admin membership controls are also available. |
| Every team already has 3–6 members | Teams form with 1–2 members; the shop requires at least 3 after the deadline. The max-size check has a concurrency gap. |
| Any saved project is an immutable deadline snapshot | Endpoints check the current deadline; Admin deadline changes can reopen edits. No snapshot is stored. |
| Team names freeze with submissions | Rename endpoint/UI have no deadline check. |
| Write-ups render Markdown | `story_markdown` is rendered as plain text. |
| Webhook receipt delivers inventory | Receiver saves events; manual order reconciliation currently fulfills. Stable deployment and automatic event processing are planned. |
| Reconciliation processes/marks inbox events | Admin/CLI reconcile unfinished orders directly; inbox processing markers are not updated. |
| Multi-business team isolation is implemented | One global business/credential set and supplier; explicit per-team entities. Ramp visibility is unverified. |
| Cash reservation is a complete lifecycle | Cash is reduced through separate writes at order creation; no reservation ledger or automatic refund exists. |
| Every PRD scenario/status is implemented | Equipment/error/duplicate exercises, recipes, metrics, and participant status board are proposed; several proposed statuses are absent/unused. |
| Vercel deployment/provider settings were checked by this audit | Deployment is upcoming; SMTP, DNS, Auth limits, and Ramp UI checks are historical records. |

## Confirmed gaps for follow-up

These are audit findings, not features implemented by this cleanup.

### Authorization and membership

**Former members retain direct Data API reads through the live RLS helper.** `private.is_team_member` checks `(team_id, user_id)` but omits `left_at IS NULL`. Policies for teams/orders/order lines/inventory use it, so historical membership continues to authorize reads. Application routes derive active membership correctly; that does not repair direct Data API authorization. Fix the helper through a reviewed migration and verify removed/reassigned users lose old-team access.

**Invite acceptance and team capacity are not serialized.** `acceptInvite` checks the token, inserts membership, then marks the invite consumed through separate writes. Two different users can race to accept one token. The live team-size trigger counts rows without locking the team, so concurrent joins can exceed six. The active-membership unique index still prevents one user joining two teams in the same event. Team creation also uses separate writes and ignores submission-insert errors, which can leave partial teams.

**Invites are dropped across authentication.** The email request does not preserve `?invite=…`; the callback always redirects to `/`. A new participant must reopen the original invitation. Owner/Admin-created invitations are single-use in sequential operation, not a reusable team-wide join link.

### Cash and order reliability

**Order creation is nontransactional and lacks request deduplication.** `createOrder` reads a balance, inserts order and lines, then writes the calculated balance and Ramp snapshot separately. Balance/snapshot errors are not checked. Concurrent requests can consume the same cash; failures can leave partial state. Every request allocates a new order ID, so browser disabling is not server-side retry protection.

**Rejected/archived bills do not refund cash.** `statusFor` maps rejection/archive to `REJECTED`. There is no refund function or order trigger in the live schema; its only public row trigger is the membership size check. Fulfillment does not touch cash because it was deducted earlier. Admin balance adjustment is currently the manual remedy.

**Ramp draft synchronization is not fully serialized.** The conditional `create_attempted_at` update does not inspect affected rows; rereading an existing timestamp does not prove this process acquired the claim. Concurrent synchronization can both proceed. Several database update errors in synchronization are ignored. Existing lookup/mapping checks provide recovery safeguards but do not prove exactly-once draft creation.

### Submissions and participant experience

**Team naming ignores the deadline.** PATCH checks active membership but no deadline. Submission/image endpoints do check the deadline, though checking before separate writes does not provide an atomic freeze at the exact boundary.

**Submission saves are not atomic.** The endpoint updates content, deletes all links, then inserts replacements. Failures/concurrent saves can leave content and links inconsistent. Moving the deadline can reopen editing; no frozen version is materialized.

**Shop eligibility is narrower than the documented project-completion concept.** It checks deadline, active-member count, and existence of a submission row, not nonempty title/write-up. The storefront is displayed before eligibility and only blocks at order submission. Team status in the Admin UI is computed separately and does not check submission existence.

**Participant order recovery is limited.** Storefront confirmation/polling tracks an order only in component state. Reloading loses that view; there is no participant order-history or inventory UI. Polling shows fulfillment/integration errors but does not explain rejection or detailed approval/payment stages.

**Admin deadline input uses UTC as local time.** `toISOString().slice(0,16)` initializes a `datetime-local` input; saving interprets it in the browser's local timezone. An unchanged save can shift the deadline for non-UTC users.

**Public links accept unrestricted URL schemes.** Submission validation uses `z.url()` and public pages render stored URLs as anchors. Restrict allowed protocols to the intended web links in a follow-up validation change.

### Operations and verification

- Order input accepts repeated product IDs without merging/rejecting them; the fulfillment insert then receives repeated inventory keys. Include this case when adding order validation/fulfillment checks.
- Stable signed-webhook deployment and automatic processing are planned. Removing unused scaffolding does not remove that requirement. Scheduled reconciliation fallback remains separately deferred.
- Admin reconciliation is event-scoped; CLI reconciliation scans all unfinished orders in the project.
- The 30-email/hour Auth limit and delivery settings are reported operations facts, not values verified in this audit. Event-scale capacity and inbox placement still need checking.
- The automated suite contains one signature-verification test; it does not prove authorization, membership concurrency, cash lifecycle, retry safety, or live payment behavior.

## Validation

Passed `npm test` (one signature test), `npm run lint`, `npm run build`, `tsc --noEmit --noUnusedLocals --noUnusedParameters`, and `git diff --check`. The first build/type check referenced the deleted legacy route in a stale `.next/dev/types/validator.ts`; clearing that generated validator resolved it. Package-lock refresh reported no dependency vulnerabilities. Live-provider rehearsals and database mutations were outside this audit; database evidence above was read-only.
