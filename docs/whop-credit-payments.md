# Whop card payments for service credits

This integration adds one-time USD credit purchases using Whop's hosted checkout.
Card numbers and CVC never pass through this application. The production checkout
switch is **off by default**. A successful local test or build does not mean the
Whop account has been approved or that production payments are enabled.

## Business information

Use the real business and service description, including the destination website:

**iUnlockMobile Service Credits**

> Prepaid account credits on https://iunlockmobile.com for device information
> reports, carrier unlocking and available device services, including iCloud
> activation-lock, MDM profile and Google account (FRP) removal, subject to
> eligibility. One-time purchase; no
> subscription. Credits are added to the signed-in customer account after payment
> is confirmed. Available services, eligibility, prices and delivery times are
> shown on iunlockmobile.com before each service order. Start checkout from your
> signed-in account so payment can be matched correctly. Terms:
> https://iunlockmobile.com/terms. Support: https://iunlockmobile.com/contact.

The description and the merchant's disclosures to Whop must cover **all** services
that the shared credit balance can buy. Do not describe a general-purpose balance
as report-only credit if other services remain purchasable. If Whop approves only
part of the catalogue, restrict the credit balance/catalogue accordingly before
enabling this integration. Never use a different description to hide a service.

Keep the product hidden. Keep any manually created placeholder price at stock 0.
The application creates a hidden, one-use, one-time price for each authenticated
invoice ($1–$1,000). Do not distribute a generic checkout link: it lacks the local
invoice reference needed to credit the correct customer. Disable discounts and
affiliates unless their effect on settlement has been explicitly implemented.

The card form offers $10, $25, $50, $100, $250 and $500 shortcuts plus a custom
USD amount with at most two decimal places. Its live summary shows the credit
the customer will receive. The $1–$1,000 range is this application's current
limit, not a claimed Whop-wide limit. Shortcuts outside a configured range are
hidden. Each choice uses the same owner-bound checkout flow; do not create
public reusable price links for the shortcuts.

## Configuration

Use a company API key for the correct Whop account. The current create-checkout
endpoint documents these permissions (the dashboard displays friendly names):

| Permission | Dashboard label | Purpose |
| --- | --- | --- |
| `checkout_configuration:create` | Create checkout configurations | Create hosted checkouts |
| `checkout_configuration:basic:read` | Read checkout configurations | Return the checkout configuration |
| `plan:create` | Create plans | Create the invoice's one-time price |
| `access_pass:create` | Create products | Required by the create-checkout endpoint |
| `access_pass:update` | Update products | Required by the create-checkout endpoint |
| `payment:basic:read` | Read payments | Retrieve authoritative payment state |

This integration does not call charge, refund or payout APIs. Enter the real
account and product identifiers; sandbox needs its own credentials and product.
Pin the key and REST client to API date **2026-10-15-1**. Use API version **v1**
for the webhook. API-created webhooks can use the same date pin. The dashboard
does not expose that setting: its unpinned v1 envelope uses `company_id` instead
of `account_id`. Both supported envelopes are signature/account checked; other
date pins are rejected. The handler takes only the payment ID from the event and
always retrieves the payment using the date-pinned REST client before settlement.
`@whop/sdk` is pinned to 2.6.0. Review schema changes before upgrading either.

Set these only in the server's protected environment file, shared by the app and
the poll worker. The deployment example keeps secrets blank:

```dotenv
IUNLOCKMOBILE_WHOP_ENABLED=0
WHOP_MODE=live
WHOP_ACCOUNT_ID=biz_REPLACE
WHOP_PRODUCT_ID=prod_REPLACE
WHOP_API_KEY=
WHOP_WEBHOOK_SECRET=
IUNLOCKMOBILE_PUBLIC_ORIGIN=https://iunlockmobile.com
```

Do not put keys in GitHub, client-side `NEXT_PUBLIC_` variables, screenshots or logs.
The webhook signing secret is used literally, including its `ws_` prefix; the SDK
handles the signature encoding. The application refuses sandbox checkout when
`NODE_ENV=production`. Test sandbox on a separate development database/process.

## Webhook setup and activation

Endpoint: `https://iunlockmobile.com/api/webhooks/whop` (POST, HTTPS).

Subscribe to:

- `payment.succeeded`, `payment.failed`, `payment.canceled`
- `refund.created`, `refund.updated`
- `dispute.created`, `dispute.updated`, `dispute_alert.created`
- `resolution_center_case.created`, `resolution_center_case.updated`,
  `resolution_center_case.decided`

Deploy the code with checkout disabled, set the secret, and restart the app before
enabling deliveries. The webhook verifies raw-body signatures, replay time,
account, API version and event ID, then commits a minimal durable inbox record
before acknowledging the event. No customer metadata or cardholder details are
saved in that inbox. Whop may retry or reorder notifications.

The post-response handler processes a few jobs immediately. The existing
`unlockservice-poll.timer` / `npm run provider:poll` retries outstanding events
after restarts and rechecks up to five settled payments per run. Each payment is
eligible for rechecking after 15 minutes; the actual interval grows with backlog.
Verify this timer is active, uses the same database/environment, and completes
within its service timeout. Monitor its exit status and pending inbox records.

Before changing `IUNLOCKMOBILE_WHOP_ENABLED` to `1`:

1. Confirm Whop has the real business disclosures and payment onboarding is
   complete for the services the credit can buy.
2. Run the sandbox flow with a verified website account: checkout, 3DS, success,
   declined card, duplicate delivery, partial/full refund and dispute handling.
3. Verify a payment credits its signed-in website owner even if the browser never
   returns from Whop. Refreshing the return page must never issue credit.
4. Confirm webhook deliveries return 200, the payment is retrieved from Whop, and
   the ledger contains exactly one top-up. Check the worker's retry path too.
5. Configure live credentials and complete an owner-authorized low-value live
   payment and refund. Do not run a live charge without the payer's authorization.
6. Enable checkout and restart the app only after these checks pass. Publishing
   the hidden product is not necessary for the application's private checkout.

The repository's deployment workflow currently auto-deploys the
`claude/website-design-patterns-5043ix` branch when its deployment gate is enabled.
A PR to `main` does not, by itself, deploy this integration. Release through the
repository's actual production workflow and verify the running revision.

## Settlement and operational review

The server retrieves each payment with the API key. It verifies account, product,
checkout, price, invoice metadata, USD amount, card method and one-time billing.
Credit comes from the stored invoice, never a browser amount or webhook amount.
Exclusive tax is charged by Whop but never added to account credit. Discounts,
unexpected methods or mismatched totals require review. Failed attempts do not
bind the invoice or overwrite a successful payment.

The top-up, invoice state and ledger transition commit in one SQLite transaction.
Duplicate webhooks and concurrent workers cannot add credit twice. A second
settled payment for the same invoice is flagged for manual review/refund, not
credited again. Old provider snapshots cannot roll a payment back.

Refunds reverse only the refunded service principal (`refunded_amount` minus
`tax_refunded_amount`). Full refunds reverse the full credit. The debit never
consumes an existing order's reserved balance or makes the balance negative.
If available credit is insufficient, the remaining debt is recorded and new
service orders are blocked through the shared credit reservation function. A
later reconciliation collects the remainder when credit becomes available.
Existing reserved orders keep their normal settlement path.

Open/lost disputes and unresolved alerts pause new service spending for review.
A verified merchant win releases a dispute-only pause. A lost dispute requires
operator reconciliation with Whop; do not independently refund an already
reversed charge. Multiple-payment and amount-mismatch flags require an operator
to investigate before clearing them. The integration does not automatically
submit dispute evidence or issue monetary refunds.

`/admin/payments` shows review, unmatched-event and retry counts. Inspect the
Whop payment and the associated `whop_topups` / `credit_ledger` records before
adjusting credit. Never use the crypto/manual invoice approval endpoint for a
Whop invoice; the generic approval helper explicitly refuses it. For a payment
whose success webhook was never received, redeliver its event from Whop: periodic
reconciliation can only find payment IDs the application has already received.

For an emergency stop, set `IUNLOCKMOBILE_WHOP_ENABLED=0` and restart. Keep the API
key, webhook secret, endpoint and worker active so already-issued checkout links,
refunds and disputes can still settle. The switch prevents **new** checkouts; it
does not revoke an already-issued Whop checkout URL. Disable those in Whop if a
complete collection stop is necessary.

## Validation

```sh
npm run lint
npm run typecheck
node --import tsx --test 'tests/**/*.test.ts'
npm run build
```

The Whop integration tests exercise the real SDK request shape and signing
verifier against mocked HTTP and an isolated SQLite database. They cover owner
binding, retry idempotency, invalid signatures, declined-then-paid attempts,
concurrent deliveries, amount/method mismatches, tax-aware refunds, refund
shortfalls, disputes, duplicate charges and transaction rollback. They do not
replace sandbox or live provider acceptance testing.

Official references:

- https://docs.whop.com/developer/guides/accept-payments
- https://docs.whop.com/developer/guides/webhooks
- https://docs.whop.com/api-reference/checkout-configurations/create-checkout-configuration
- https://docs.whop.com/api-reference/beta/payments/retrieve-payment
- https://github.com/whopio/whopsdk-typescript
