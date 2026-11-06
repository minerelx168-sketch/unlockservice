# Carrier screening and one abandoned-checkout reminder

This release is based on production `9a7191aeb3295db1fe34290675c214ab859e8f3e`. Do not merge unrelated main changes, pricing, provider mappings, or the currently blocked SEO candidate into it.

## Supported-carrier notice

The notice requested by the site owner is:

> Supported: AT&T & C Spire postpaid/contract phones (iPhone + Android). Not supported: Cricket, Metro, Boost, Straight Talk, Tracfone, other prepaid.

Show it above the IMEI field on `/services/unlock` and `/services/unlock/us`. A trusted result that identifies prepaid or an MVNO must stop the applicable unlock flow before payment, using “This carrier isn't supported yet”. Do not infer postpaid eligibility merely from an AT&T brand or IMEI prefix. Do not create a paid provider order to perform this screening. Preserve raw-result rendering and the separate paid IMEI check services.

## Email behavior

Immediate guest checkout-link emails are removed from both the HTTP request and poll/recovery paths. Keep the legacy exported function as a non-sending compatibility entry point so old callers cannot accidentally revive immediate mail. Successful unlock results, payment receipts, security OTP, and necessary refund notices are separate and remain unchanged. Check-service results are not newly emailed.

The replacement is one abandoned-checkout reminder, due no earlier than five minutes after the customer opens their payment checkout. Reopening/replaying an existing bill must not restart the clock or create a second reminder. Processing happens on the existing application poll worker; delivery is therefore at the first eligible worker run, not guaranteed at precisely second 300. Return to the same selected payment method, never silently switch a customer from Whop to crypto or issue a new bill.

Recheck local paid/success/processing/review/expiry state, exact ownership, admin exclusion, opt-out and atomic claim immediately before send. Whop verification remains read-only. Unknown external state or ambiguous mail outcomes must not be interpreted as a successful send or safely retryable unpaid payment. Use a stable provider idempotency key and durable acceptance marker. Never charge a card, submit an unlock order, change a credit balance, or credit a top-up from the reminder worker.

## Sender and activation

Contact and Reply-to use `support@iunlockmobile.com` through the existing production Resend integration; never include a Resend key in Git, a client bundle, a report, or a log. The user supplied the support email as contact information, not a physical postal address. Do not copy this email into `IUNLOCKMOBILE_MARKETING_POSTAL_ADDRESS` or invent an address.

Marketing sender safeguards stay fail-closed. Deployment of code does not equal activation of email. Preserve explicit bill opt-in, verified recipient ownership, recipient-level unsubscribe, and the existing postal-address/configuration gate. Do not backfill old bills or send test/reminder mail to real customers during QA. If activation is blocked by missing sender settings, disclose it rather than claim the five-minute sending system is active.

## QA and deployment

Run focused regressions, the entire repository test suite, typecheck, lint, build, and staging HTTP guards with temporary SQLite and no live provider/payment/mail secrets. Verify both carrier-notice routes and anonymous checkout/webhook fail-closed responses. Use an exact production-parent release commit and isolated validated build. Before any production swap, preserve root-only config/GSC hashes, online SQLite backup/checksum and prior build, and use the existing timer-preserving automatic rollback pattern. Do not restart Caddy or modify credentials/prices/provider mappings.

The final delivery report must distinguish implemented paths, deliberately suppressed/unsupported paths, whether code is deployed, and whether the sender is enabled. Resend acceptance is not delivery, inbox placement, or a successful customer payment.
