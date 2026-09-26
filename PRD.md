# PRD: Ramp Bakery Bill-Pay Workshop

## Document status

- Status: Living product and operations proposal. The current implementation snapshot below is authoritative where it conflicts with aspirational workflow detail later in this document.
- Product: Interactive bakery business simulation using Ramp Sandbox Bill Pay
- Audience: Product, engineering, event operations, curriculum, and Ramp partner teams

### Current implementation snapshot (September 2026)

- Supabase Postgres and Supabase Auth replace the earlier local SQLite/prototype-auth plan.
- Participants create accounts by magic link, create or accept an invite into one team, and cannot self-switch or leave teams.
- Teams contain 3–6 participants. Team names and submission content are editable by any active member until the deadline; the latest saved version freezes automatically at the deadline.
- Submissions support a title, tagline, write-up, typed project links, images, and a shareable immutable-ID project page.
- The Admin console manages balances, membership, team merges/archiving/deletion, invitations, deadlines, Admin roles, and manual Ramp reconciliation. A Superadmin manages Admin roles.
- Webhooks are stored durably and paid bills are verified against Ramp before fulfillment. There is no continuously running reconciliation worker on Vercel Hobby; an Admin triggers reconciliation when needed.
- Resend SMTP is configured in Supabase, pending verification of the `auth.socratica.info` sending domain.

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

- Admin: Sees event operations; manages team balance, membership, invitation, merging, archival, deadline, and reconciliation controls.
- Superadmin: Has all Admin permissions and can promote, demote, or remove Admins while preserving at least one Superadmin.
- Simulated supplier: The event system that creates orders, invoices, and bills, then fulfills paid orders.

### Sandbox payment permission

Ramp's documented Sandbox Demo Action for marking a bill paid requires an Admin or Business Owner role, or the AP Clerk permission. The event team must decide whether:

- one participant per team receives that permission; or
- an Admin performs the final payment simulation after the team approves and schedules the bill.

The first option is more hands-on. The second has tighter operational control.

## 7. Proposed participant journey

### Phase A: Set up the bakery

1. Participants create a team or accept a team invite link after authenticating.
2. Each team has a self-managed bakery name; an Admin sets its initial fake cash balance.
3. Participants sign in to the correct Ramp Sandbox business.
4. An Admin explains the team roles and approval rules.

### Phase B: Order supplies

1. The purchaser opens the event's wholesale supplier portal.
2. The purchaser selects flour, butter, chocolate, packaging, equipment rental, or other fake supplies.
3. The portal shows prices, delivery times, and invoice terms such as "due on receipt" or "net 30."
4. The purchaser places the order without entering payment details.
5. The portal confirms that the supplier will invoice the bakery.

### Phase C: Receive and review the invoice

1. The event backend creates an invoice number and PDF.
2. It finds or creates the supplier as a Ramp vendor.
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
        |                          |                           | Event webhook       |
        |                          |                           | verifies + fulfills |
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
                              |          +-----------> Invoice PDF store
                              |
                              +----------------------> Admin console
```

### Responsibilities

#### Supplier portal

- Shows the fake product catalogue.
- Creates orders.
- Displays order and fulfillment status.
- Links the participant to the corresponding Ramp task where practical.

#### Event API

- Validates the team's fake cash and purchasing rules.
- Generates invoice records and PDFs.
- Creates or looks up Ramp vendors.
- Creates Ramp bills and uploads invoice attachments.
- Stores the Ramp business ID and bill ID for every order.
- Receives and verifies Ramp webhooks.
- Fulfills paid orders idempotently.

#### Event database

- Stores teams, participants, orders, line items, inventory, and game balances.
- Stores Ramp identifiers and integration state.
- Stores processed webhook event IDs.
- Remains the source of truth for the game.

#### Ramp Sandbox

- Stores vendors, bills, attachments, approvals, and payment state.
- Provides the participant-facing accounts-payable interface.
- Emits business-event webhooks.
- Remains the source of truth for bill status.

#### Admin console

- Shows recent orders and supports verified Ramp reconciliation.
- Manages team balance, membership, invitations, merges, archiving/deletion, deadlines, and Admin roles.
- Never fabricates a Ramp payment state or manually fulfills an unverified bill.

## 10. Team isolation model

### Preferred model: one Sandbox business per team

```text
Ramp Sandbox
|
+-- Team A Bakery business
|   +-- Team A users
|   +-- Team A vendors
|   +-- Team A bills and approvals
|
+-- Team B Bakery business
|   +-- Team B users
|   +-- Team B vendors
|   +-- Team B bills and approvals
|
+-- Team C Bakery business
    +-- Team C users
    +-- Team C vendors
    +-- Team C bills and approvals
```

Benefits:

- Each team experiences Ramp as its own business.
- Teams cannot see one another's suppliers or bills.
- Approval policies and roles are easy to explain.
- The event story matches the product model.

Cost:

- Ramp must help provision and configure multiple Sandbox businesses.
- OAuth credentials, webhook events, and business IDs must be handled per business.

### Fallback model: one business for the entire event

Teams share one Sandbox business and are separated with departments, locations, custom metadata, invoice prefixes, or another agreed field.

This is operationally easier but less realistic. It can also expose other teams' bills depending on Ramp roles and permissions. Use it only after validating visibility and approval behavior with Ramp.

## 11. Core data model

```text
Team
  id
  name
  fake_cash_balance
  ramp_business_id

Order
  id
  team_id
  supplier_id
  invoice_number
  total_amount
  terms
  status
  ramp_bill_id

OrderLine
  order_id
  product_id
  quantity
  unit_price

Supplier
  id
  name
  ramp_vendor_id_by_business

WebhookEvent
  ramp_event_id
  event_type
  business_id
  object_id
  processed_at
  processing_result
```

### Order statuses

```text
DRAFT
  -> SUBMITTED
  -> BILL_CREATING
  -> AWAITING_RAMP_REVIEW
  -> APPROVED
  -> PAYMENT_PENDING
  -> PAID
  -> FULFILLED

Alternate exits:
  REJECTED
  CANCELLED
  INTEGRATION_ERROR
```

The application should not infer `PAID` merely because a bill was approved. Only a verified `bills.paid` event or a successful bill-status reconciliation may cause the paid transition.

## 12. Ramp integration behavior

### Creating a bill

For each submitted supplier order, the backend should:

1. Confirm the team has enough fake cash according to the game rules.
2. Generate a stable internal order ID and invoice number.
3. Resolve the team's Ramp business and access token.
4. Find or create the vendor for that Sandbox business.
5. Create the bill or draft bill with the agreed amount, invoice number, due date, vendor, and team attribution.
6. Upload the generated invoice PDF as an `INVOICE` attachment.
7. Persist the returned Ramp bill ID before returning success to the browser.
8. Display the Ramp bill link if the API response provides one or it can be constructed safely.

### Receiving `bills.paid`

The webhook handler should:

1. Read the unmodified request body.
2. Verify the `X-Ramp-Signature` HMAC using the subscription secret.
3. Return a successful response quickly and queue processing.
4. Reject unsupported event types.
5. Deduplicate using the Ramp event ID.
6. Identify the Ramp business using `business_id`.
7. Find the order using the bill resource ID.
8. Fetch the bill from Ramp when confirmation or additional fields are needed.
9. Mark the order paid exactly once.
10. Deduct fake cash and add inventory in one database transaction.
11. Record the result for Admin support and auditing.

### Webhook retry behavior

Ramp may retry failed webhook deliveries. The same event ID is reused across retry attempts. The application must treat repeated delivery as normal and must never deliver supplies twice.

### Reconciliation fallback

A future periodic reconciliation job may inspect orders stuck in `PAYMENT_PENDING` or `AWAITING_RAMP_REVIEW`, fetch the associated bill from Ramp, and repair missed state transitions. Until then, an Admin triggers the same reconciliation on demand.

Until an automated job is justified, the Admin console runs reconciliation on demand to protect the event from temporary webhook, network, or deployment failures.

## 13. Approval scenarios

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

Recommended rule:

- Reserve the order amount when the bill is submitted.
- Release the reservation if the bill is rejected or cancelled.
- Convert the reservation into spent cash when `bills.paid` arrives.
- Add supplies to inventory only when the order is fulfilled.

```text
Available cash = Starting cash - Reserved unpaid bills - Paid bills
```

This prevents a team from placing unlimited orders while several invoices await approval.

## 15. Functional requirements

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
- Manage team balance, membership, invitations, merging, archive/delete, and deadline controls.
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

The second delivery finds the event ID already processed and returns success without changing inventory.

### Bill is rejected

Release the fake-cash reservation, mark the order rejected, and allow the supplier flow to create a corrected order or invoice.

### Participant pays the wrong bill

Do not fulfill an order unless the paid Ramp bill ID is mapped to it. Surface the unexpected payment to an Admin.

### Ramp Sandbox is unavailable

Pause new order submission, preserve existing orders, and give Admins a documented manual recovery procedure. Do not pretend bills were paid in Ramp.

## 18. Event operations

### Before the event

- Provision Sandbox business or businesses.
- Invite participants and confirm every account can sign in.
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
- Median time from `bills.paid` delivery to game fulfillment is under 5 seconds.
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
