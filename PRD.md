# PRD: Ramp Bakery Bill-Pay Workshop

## Document status

- Status: Living product and operations proposal. The current implementation snapshot below is authoritative where it conflicts with aspirational workflow detail later in this document.
- Product: Interactive bakery business simulation using Ramp Sandbox Bill Pay
- Audience: Product, engineering, event operations, curriculum, and Ramp partner teams

### Current implementation snapshot (audited September 28, 2026)

- Supabase Postgres and Supabase Auth are the active database and identity system. SQLite runtime code was removed. Local Postgres migrations are a partial copy of the remote Supabase history, not a complete database bootstrap.
- Participants authenticate by magic link, then create or join one open team. Participants have no self-service leave, switch, delete, or merge endpoints.
- A database unique index enforces one active membership per event. Team joins lock the target team before checking the six-member maximum. Teams may have fewer than three participants while forming.
- Orders require at least three active members, a submission row, and a passed submission deadline. A completed write-up is not required. New teams start with zero cash and need an Admin allocation plus an explicit Ramp entity mapping.
- Active members can edit submissions and images until the deadline. Team renaming currently has no deadline check. There is no immutable submission snapshot; changing the event deadline can reopen editing.
- Submissions support a title, tagline, plain-text write-up (stored as `story_markdown` but not rendered as Markdown), typed project links, images, and public pages addressed by stable submission IDs.
- The Admin console manages balances, membership reassignment/removal, order-free team merges, empty-team soft deletion, deadlines, and manual Ramp reconciliation. Superadmins manage Admin roles.
- Runtime Ramp configuration supports one Sandbox business and supplier with per-team entity mappings. Separate Sandbox businesses per team would require integration changes.
- The signed webhook receiver is implemented; stable deployment and automatic event processing are planned. Currently, received webhooks are stored durably without initiating reconciliation or fulfillment. Admin/CLI reconciliation fetches and validates bills; the live Supabase fulfillment function locks the order and updates inventory atomically and idempotently.
- Cash is deducted at order creation through separate database writes. Transactional reservation, request deduplication, and rejected-order refunds are not implemented.
- The September 28 operations record reports successful Resend/Supabase magic-link delivery and a 30-email/hour project-wide limit. The audit did not recheck SMTP, DNS, or Auth dashboard settings.
- All public tables have RLS enabled. The membership helper excludes former members, and application routes also filter active membership.

See [docs/codebase-audit.md](./docs/codebase-audit.md) for evidence, cleanup, and remaining gaps. Later goals, scenarios, requirements, metrics, and acceptance criteria are proposals; they do not establish that a feature or live test is complete. Ramp isolation/payment rehearsal is paused while its demo site is having issues; stable webhook deployment is planned separately on Vercel.

## 1. Summary

Event attendees work in teams and pretend to run local bakeries. Teams buy fake ingredients and supplies from a simulated wholesale supplier. They do not pay at checkout. Instead, the supplier sends an invoice, the invoice becomes a bill in Ramp Sandbox, and the team uses Ramp to review, approve, and pay it.

After Ramp reports that the bill was paid, the event application delivers the fake supplies to the team's bakery inventory. Teams then use those supplies to complete recipes or other event challenges.

This creates a realistic small-business accounts-payable experience:

```text
Order supplies -> Receive invoice -> Review bill -> Approve -> Pay in Ramp
       -> Ramp confirms payment -> Receive supplies -> Run the bakery
```

No real money, inventory, or supplier relationship is involved. Ramp Sandbox owns the bill-pay learning experience. The event application owns the game.

## 2. Problem

We want attendees to understand how a local business uses Ramp, rather than merely watch a product demo.

A fake card checkout does not map cleanly to the current public Sandbox APIs because an external application cannot create arbitrary simulated card transactions through the Developer API. Bill Pay is a better fit: the API can create vendors and bills, attach invoice files, and notify our application when bills are approved or paid.

The experience should teach attendees:

- Why a supplier invoice becomes a bill in the buyer's accounting process.
- How a business reviews invoice details before paying.
- How approval roles and thresholds work.
- How Ramp records the status and audit history of a bill.
- How an external business system can react to Ramp events through webhooks.

## 3. Goals

### Participant goals

- Every team runs a recognizable local bakery business.
- Participants order supplies without paying at point of purchase.
- Each order produces a realistic supplier invoice.
- Participants use Ramp Sandbox to review, approve, and pay bills.
- Different team members can perform different business roles.
- Payment completion visibly causes supplies to arrive in the game.

### Product goals

- Create each Ramp bill automatically from the supplier order.
- Reliably associate each event order with its Ramp bill.
- Persist and verify Ramp webhook signals, with manual Admin reconciliation as the current missed-event fallback.
- Prevent duplicate fulfillment when Ramp retries a webhook.
- Give Admins enough visibility and safe controls to unblock teams during the event.
- Preserve an audit trail for demonstrations and post-event analysis.

## 4. Non-goals

- Moving real money.
- Charging real or simulated credit cards.
- Treating the event application as a payment processor.
- Reproducing every Ramp accounting or ERP feature.
- Creating a production Ramp account for an attendee.
- Teaching consumer checkout behavior.
- Using Ramp bills as the authoritative source for recipe inventory or game scoring.

## 5. Experience principles

1. The business story should make sense without explaining the software architecture.
2. Important actions should happen in Ramp, not in a fake copy of Ramp.
3. The event application should automate setup and reconciliation around Ramp.
4. Every state should be recoverable by an Admin.
5. Teams should never be blocked indefinitely by a delayed webhook or an accidental browser refresh.

## 6. Users and roles

### Bakery team roles

These are workshop roles. They may map to Ramp roles differently depending on the final Sandbox setup.

- Purchaser: Chooses supplies and places orders in the supplier portal.
- Accounts payable clerk: Opens the bill in Ramp, checks the supplier, invoice, amount, and due date.
- Bakery manager: Approves bills that require approval.
- Business owner: Makes final decisions on expensive or unusual purchases.

Participants should rotate roles during the session so everyone interacts with Ramp.

### Event roles

- Admin: Sees event operations; manages team balance, membership, merging, soft deletion, deadline, and reconciliation controls.
- Superadmin: Has all Admin permissions and can promote, demote, or remove Admins while preserving at least one Superadmin.
- Simulated supplier: The event system that creates orders, invoices, and bills, then fulfills paid orders.

### Sandbox payment permission

Ramp's documented Sandbox Demo Action for marking a bill paid requires an Admin or Business Owner role, or the AP Clerk permission. The event team must decide whether:

- one participant per team receives that permission; or
- an Admin performs the final payment simulation after the team approves and schedules the bill.

The first option is more hands-on. The second has tighter operational control.

## 7. Proposed participant journey

### Phase A: Set up the bakery

1. Participants create a team or join an open team after authenticating.
2. Each team has a self-managed bakery name; an Admin sets its initial fake cash balance.
3. Participants sign in to the correct Ramp Sandbox business.
4. An Admin explains the team roles and approval rules.

### Phase B: Order supplies

1. The purchaser opens the event's wholesale supplier portal.
2. The purchaser selects flour, butter, chocolate, packaging, equipment rental, or other fake supplies.
3. The current portal shows prices and fixed Net 7 terms. Delivery estimates and selectable terms remain proposed.
4. The purchaser places the order without entering payment details.
5. The portal confirms that the supplier will invoice the bakery.

### Phase C: Receive and review the invoice

1. The event backend creates an invoice number and PDF.
2. It uses the configured supplier vendor; vendor setup is a separate operations script.
3. It creates a Ramp Sandbox bill and attaches the invoice PDF.
4. The supplier portal changes the order status to `Awaiting review in Ramp`.
5. The accounts-payable participant opens Ramp and checks:
   - supplier name;
   - invoice number;
   - amount;
   - due date;
   - attached invoice;
   - accounting fields or memo, if included in the workshop.

### Phase D: Approve and pay

1. Ramp routes the bill according to the configured approval policy.
2. The appropriate participant approves or rejects it.
3. An approved bill is scheduled or otherwise made eligible for payment according to the Sandbox configuration.
4. An authorized participant or Admin uses the Sandbox Demo Action to mark the current bill paid.
5. Ramp emits a `bills.paid` webhook.

### Phase E: Fulfill the order

1. The event backend records the signed webhook and an Admin reconciliation pass fetches and verifies the authoritative bill.
2. It finds the event order associated with the Ramp bill.
3. It fetches the latest bill from Ramp if additional confirmation is needed.
4. It marks the order paid exactly once.
5. It adds the ordered supplies to the team's game inventory.
6. The supplier portal changes the status to `Delivered`.
7. The team can use the supplies in the next bakery challenge.

## 8. End-to-end flow

```text
+----------------+       +-------------------+       +-------------------+
| Team purchaser |       | Supplier portal   |       | Event backend     |
+-------+--------+       +---------+---------+       +---------+---------+
        |                          |                           |
        | Selects supplies         |                           |
        +------------------------->|                           |
        |                          | Creates order             |
        |                          +-------------------------->|
        |                          |                           | Generate invoice
        |                          |                           | Create Ramp bill
        |                          |                           | Save order/bill link
        |                          |                           |
+-------+--------+       +---------+---------+       +---------+---------+
| Team AP/owner  |       | Ramp Sandbox UI   |       | Ramp API/webhooks |
+-------+--------+       +---------+---------+       +---------+---------+
        |                          |                           |
        | Reviews invoice          |                           |
        +------------------------->|                           |
        | Approves bill            |                           |
        +------------------------->|                           |
        | Marks bill paid          |                           |
        +------------------------->|                           |
        |                          | Payment completion        |
        |                          +-------------------------->|
        |                          |                           | bills.paid
        |                          |                           +----------+
        |                          |                                      |
        |                          |                           +----------v----------+
        |                          |                           | Webhook saves event |
        |                          |                           | Admin sync fulfills |
        |                          |                           +----------+----------+
        |                          |                                      |
        |<-------------------------+-------------- Supplies delivered ----+
```

## 9. System architecture

```text
                              RAMP SANDBOX
                +---------------------------------------+
                |                                       |
                |  +-------------+    +--------------+  |
                |  | Ramp UI     |    | Developer API|  |
                |  | review/pay  |    | vendors/bills|  |
                |  +------+------+    +------+-------+  |
                |         |                  |          |
                |         +--------+---------+          |
                |                  |                    |
                |            +-----v------+             |
                |            | Bill state |             |
                |            +-----+------+             |
                |                  | bills.paid          |
                +------------------+--------------------+
                                   |
                                   v
+------------------+       +-------+---------+       +------------------+
| Supplier portal  |<----->| Event API       |<----->| Event database   |
| catalogue/orders |       | orders/webhooks |       | teams + mappings |
+------------------+       +---+----------+--+       +------------------+
                              |          |
                              |          +-----------> PDF generated on demand
                              |
                              +----------------------> Admin console
```

### Responsibilities

#### Supplier portal

- Shows the fake product catalogue.
- Creates orders.
- Displays order and fulfillment status.
- Shows instructions to open Ramp Bill Pay; individual bill deep links are not implemented.

#### Event API

- Validates the team's fake cash and purchasing rules.
- Generates invoice records and PDFs.
- Uses the configured Ramp supplier; a separate setup script creates or looks up that vendor.
- Creates Ramp bills and uploads invoice attachments.
- Stores the entity/vendor snapshot, draft ID, and eventual bill ID; the business ID is configured globally.
- Receives and verifies Ramp webhooks.
- Fulfills paid orders idempotently.

#### Event database

- Stores teams, participants, orders, line items, inventory, and game balances.
- Stores Ramp identifiers and integration state.
- Deduplicates received webhook event IDs. Processing marker columns exist but are not updated by the current runtime.
- Remains the source of truth for the game.

#### Ramp Sandbox

- Stores vendors, bills, attachments, approvals, and payment state.
- Provides the participant-facing accounts-payable interface.
- Emits business-event webhooks.
- Remains the source of truth for bill status.

#### Admin console

- Shows recent orders and supports verified Ramp reconciliation.
- Manages team balance, membership, merges, soft deletion, deadlines, and Admin roles.
- Never fabricates a Ramp payment state or manually fulfills an unverified bill.

## 10. Team isolation model

### Current integration: one Sandbox business, explicit team entities

The runtime uses one global set of credentials, one supplier vendor, and one expected webhook business ID. Each team maps to a distinct Ramp entity through `team_ramp_entities`. Entity-restricted participant Bill Pay permissions and cross-team visibility still need live verification; entity attribution alone does not prove isolation.

### Proposed alternative: one Sandbox business per team

Separate businesses could provide stronger separation, but require per-business credentials, vendors, and webhook routing. These are not implemented. Decide on this model with Ramp before changing the integration.

## 11. Core data model

Supabase contains:

- `events`, `profiles`, `teams`, and `team_members`
- `event_admins`, `superadmin_bootstraps`, and `team_balance_adjustments`
- `submissions`, `submission_links`, and `submission_assets`
- `team_ramp_entities`, `orders`, `order_lines`, and `order_ramp_sync`
- `inventory`, `webhook_events`, and `ramp_webhook_challenges`

The supplier ID is configuration (`RAMP_VENDOR_ID`), not a supplier table. Cash and order prices use integer cents. Submission images are in the public `submission-media` Storage bucket; invoice PDFs are generated on demand and attached to Ramp.

### Current order transitions

```text
BILL_CREATING -> AWAITING_RAMP_REVIEW -> PAYMENT_PENDING -> FULFILLED
                           |                 |
                           +---- REJECTED ---+

Setup/provider failures -> INTEGRATION_ERROR -> manual reconciliation
```

`APPROVED` and `PAID` are allowed by the live schema but are not emitted as separate stages by current reconciliation. `DRAFT`, `SUBMITTED`, and `CANCELLED` are not current order statuses. A Ramp draft is represented by `ramp_status=DRAFT` while the order is `AWAITING_RAMP_REVIEW`.

Only a fetched, matching bill with `status=PAID` and `status_summary=PAYMENT_COMPLETED` can trigger fulfillment. A webhook payload never proves payment.

## 12. Current Ramp integration behavior

### Creating a draft

1. Derive the participant's active team server-side and check shop eligibility.
2. Check available cash, allocate an order/invoice ID, and read the team's explicit Ramp entity mapping.
3. Save the order, lines, reduced balance, and entity/vendor snapshot through separate writes. Atomic reservation remains outstanding.
4. Search for a matching existing bill/draft before creating a Ramp draft. A saved creation-attempt marker blocks blind retries after an uncertain result; concurrent synchronization is not fully serialized.
5. Generate and attach the invoice PDF, save the draft ID, and set the order to awaiting review.
6. After human submission in Ramp, reconciliation locates the matching bill and stores its bill ID.

The portal provides PDF download and printable invoice links, plus instructions to open Ramp Bill Pay. It does not link directly to a Ramp bill.

### Receiving events

1. Verify the exact raw bytes against the subscription secret. A separate setup token is allowed only for verification challenges, not bill events.
2. Validate the event and expected business ID; acknowledge unsupported event types without storing them.
3. Save supported events with deduplication by Ramp event ID before returning success.

Automatic processing of stored webhook events is planned when the stable receiver is deployed. No worker drains this inbox yet. Admin/CLI reconciliation currently operates on unfinished orders independently of inbox rows and does not mark events processed.

### Reconciliation and fulfillment

Admin reconciliation checks unfinished orders in the configured event; the CLI checks unfinished orders across the connected database. Each fetches authoritative Ramp resources, validates entity, supplier, invoice, currency, amount, and known draft/bill mapping, and calls Supabase fulfillment only for a completed payment. The database locks the order, adds inventory, and sets `FULFILLED` in one transaction. Cash was already deducted at order creation and is not deducted again.

A periodic reconciliation job is deferred until unattended operation is needed. Live payment and two-team isolation verification remain outstanding.

## 13. Approval scenarios

These are curriculum proposals. Equipment rentals, deliberate invoice-error injection, corrected-invoice flows, and duplicate-invoice exercises are not implemented in the current six-product catalogue.

The workshop should include more than one approval path.

### Scenario 1: Routine ingredients

- Small order.
- One manager approval or automatic approval, depending on the lesson.
- Shortest route to payment.

### Scenario 2: Expensive equipment

- Large order for a mixer or oven rental.
- Requires business-owner approval.
- Demonstrates policy thresholds and separation of duties.

### Scenario 3: Incorrect invoice

- Invoice quantity or amount does not match the order.
- Team should reject or hold the bill rather than pay it.
- Supplier portal issues a corrected invoice after the discrepancy is reported.

### Scenario 4: Duplicate invoice

- Supplier accidentally submits the same invoice number twice.
- Team should identify the duplicate and avoid paying it.

These scenarios teach judgment, not just button clicking.

## 14. Fake business economics

Ramp Sandbox does not move real money. The event application therefore owns the team's simulated operating cash.

Current behavior deducts the amount when the order is created. There is no separate reservation ledger, automatic rejection/cancellation refund, or cash change during fulfillment.

Target rule (not yet implemented in full):

- Reserve the order amount when the bill is submitted.
- Release the reservation if the bill is rejected or cancelled.
- Convert the reservation into spent cash when `bills.paid` arrives.
- Add supplies to inventory only when the order is fulfilled.

```text
Available cash = Starting cash - Reserved unpaid bills - Paid bills
```

The target rule should prevent overspending while invoices await approval. The current read-then-update balance flow does not serialize concurrent orders.

## 15. Functional requirements

These are target requirements. In particular, server-side order-submission deduplication, per-business vendor handling, and a next-action status display are not complete.

### Supplier portal

- Participants can browse and order supplies.
- Prices and payment terms are visible before submission.
- Participants can see invoice, Ramp, payment, and fulfillment states.
- A submitted order cannot be silently submitted twice.
- The portal provides a downloadable copy of the invoice.

### Ramp integration

- The system creates a vendor once per supplier per Ramp business.
- The system creates a unique bill for every submitted order.
- The bill amount and invoice attachment match the order.
- The system stores the Ramp bill ID.
- The system receives `bills.approved`, `bills.rejected`, and `bills.paid` events where useful.
- Only `bills.paid` or reconciliation against an actually paid bill triggers fulfillment.

### Admin tools

- View recent orders and reconcile unfinished orders against Ramp.
- Manage team balance, membership, merging, soft deletion, and deadline controls.
- Manage Admin roles as a Superadmin.
- Display which participant or Admin must take the next action.

## 16. Security and privacy

- Use Sandbox credentials only.
- Keep Ramp client secrets and access tokens server-side.
- Encrypt integration secrets at rest.
- Verify Ramp webhook signatures using the raw request bytes.
- Do not put credentials or sensitive personal data in invoice PDFs.
- Give participants the minimum Ramp role required for their task.
- Do not log OAuth tokens, webhook secrets, or complete authorization headers.
- Use synthetic bakery and supplier data throughout the event.

## 17. Reliability and failure handling

### Bill creation times out

Use an idempotency strategy based on the event order ID. Before retrying, check whether the Ramp bill ID was already persisted or whether a matching invoice number exists.

### Invoice attachment fails

Keep the order in `BILL_CREATING` or `INTEGRATION_ERROR`. Retry the attachment without creating another bill.

### Webhook is delayed or lost

Show `Waiting for Ramp confirmation`, then use the Admin reconciliation action to fetch current bill state.

### Webhook arrives twice

The repeated event ID is deduplicated during storage. Receiving either delivery does not fulfill inventory; manual reconciliation uses the idempotent database function.

### Bill is rejected

Current reconciliation marks the order rejected but does not refund cash. Automatic reservation release and a corrected-invoice flow remain requirements. Admin balance adjustment is the current manual tool.

### Participant pays the wrong bill

Do not fulfill an order unless the paid Ramp bill ID is mapped to it. Surface the unexpected payment to an Admin.

### Ramp Sandbox is unavailable

Pause new order submission, preserve existing orders, and give Admins a documented manual recovery procedure. Do not pretend bills were paid in Ramp.

## 18. Event operations

This is a proposed runbook. A participant status board, recipe/challenge gameplay, and metrics export are not implemented. Vercel deployment and live Ramp rehearsal are separate upcoming work.

### Before the event

- Provision Sandbox business or businesses.
- Confirm every participant can sign in, create a team, or join an open team.
- Configure roles and approval policies.
- Confirm who has permission to use the bill-payment Demo Action.
- Create and verify webhook subscriptions.
- Run a complete order-to-fulfillment test for every Sandbox business.
- Seed suppliers and validate vendor reuse.
- Test invoice rendering on mobile and desktop.
- Test duplicate webhooks and reconciliation.

### During the event

- Admins monitor stuck orders and webhook health.
- A visible status board shows the current stage for each team without exposing private details.
- Teams rotate purchaser, AP, and approver roles.
- Admins avoid performing actions for participants unless necessary to recover the exercise.

### After the event

- Export anonymized metrics.
- Revoke or deactivate attendee Sandbox access as agreed with Ramp.
- Archive event credentials and delete temporary secrets.
- Review failed orders, delayed webhooks, and participant feedback.

## 19. Success metrics

- At least 90% of teams complete one full order-to-paid-to-delivered flow without Admin intervention.
- At least 80% of participants perform at least one meaningful action in Ramp.
- Median time from order submission to bill visible in Ramp is under 10 seconds.
- Target median time from `bills.paid` delivery to game fulfillment is under 5 seconds; manual reconciliation does not currently guarantee this.
- No order is fulfilled twice.
- No team can spend more fake cash than the game permits.
- Participants can explain the difference between an invoice, a bill, approval, and payment after the workshop.

## 20. Acceptance criteria for the first pilot

The pilot is ready when:

1. A participant can place a supply order.
2. A matching bill and invoice attachment appear in the correct Ramp Sandbox business.
3. A different participant can approve the bill in Ramp.
4. An authorized user can complete the Sandbox payment simulation.
5. Ramp sends a valid `bills.paid` webhook containing the expected business and bill identifiers.
6. The event application fulfills the correct order exactly once.
7. A duplicated webhook does not duplicate inventory.
8. A missed webhook is repaired by reconciliation.
9. An Admin can trace an order from event order ID to invoice number to Ramp bill ID.

## 21. Decisions needed from Ramp

1. Can Ramp provision one Sandbox business per team at the expected event scale?
2. What is the simplest authentication model for a partner application spanning those businesses?
3. Does the Sandbox Demo Action that marks a bill paid emit the standard `bills.paid` webhook in every proposed configuration?
4. Can the final payment simulation be performed by an attendee with AP Clerk permission, or should it be Admin-only?
5. Should the Bill Pay payment-release setting be enabled or disabled for the workshop?
6. If enabled, what exact scheduling step must attendees complete before `pay current bill` becomes available?
7. Which fields should carry team/order attribution while remaining visible and understandable in the Ramp UI?
8. Are deep links to individual Sandbox bills stable and supported for the event portal?
9. Are there Sandbox rate limits or user/vendor/bill limits relevant to the projected event size?
10. What is Ramp's preferred cleanup process after the event?

## 22. Recommended delivery phases

### Phase 1: Technical spike

- Use one Sandbox business and one test team.
- Create vendor, bill, and invoice attachment through the API.
- Approve and mark the bill paid in Sandbox.
- Confirm receipt of a real `bills.paid` event.
- Fulfill one fake order.

### Phase 2: Workshop prototype

- Add participant roles, fake cash, inventory, and Admin tooling.
- Add routine, expensive, and incorrect-invoice scenarios.
- Test on the devices attendees will use.

### Phase 3: Multi-team pilot

- Validate the chosen isolation model.
- Test concurrent ordering and webhook traffic.
- Run the workshop with internal participants.
- Measure completion time and Admin burden.

### Phase 4: Event launch

- Freeze the workflow and configuration.
- Rehearse incident procedures.
- Pre-create accounts and verify access.
- Monitor the full experience in real time.

## 23. Reference capabilities used

- Ramp Sandbox: `https://docs.ramp.com/developer-api/v1/sandbox`
- Bills API: `https://docs.ramp.com/developer-api/v1/api/bills`
- Bill Pay guide: `https://docs.ramp.com/developer-api/v1/bill-payments`
- Webhooks and `bills.paid`: `https://docs.ramp.com/developer-api/v1/webhooks`
