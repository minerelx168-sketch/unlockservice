# Checkout reminder — production-safe release

This release preserves the deployed Whop title-30/full-description hotfix, controlled checkout-link recovery, requested initial transactional checkout email, existing payment watcher, ledger, Provider, analytics and BEP20-only new-invoice safeguards.

## Scope and default activation

A marketing reminder is distinct from the requested initial checkout link. At most one accepted reminder may follow an explicitly opted-in, owned, verified, unpaid card bill after five minutes, on the next existing poll-worker run. Five minutes is a minimum age, not a guarantee of delivery at exactly second 300.

The default is **disabled**. Production must not send unless `IUNLOCKMOBILE_CHECKOUT_REMINDERS_ENABLED=1`, a real business postal address exists in `IUNLOCKMOBILE_MARKETING_POSTAL_ADDRESS`, the existing email/Whop/public-origin/secret configuration is valid, and that bill has an explicit verified-owner opt-in. Do not invent an address or infer consent from analytics cookies, Terms, login, device ownership, or merely opening a bill. No retroactive opt-in/backfill.

At the start of this task production had neither an enabled reminder flag nor a postal address. The deployment does not modify EnvironmentFiles or enable marketing mail. The code, migration and unsubscribe endpoint can be deployed safely while the sender remains off. Opening the sender is a separate, later configuration operation after real business details are available.

Activation also requires a dedicated server-side `IUNLOCKMOBILE_CHECKOUT_REMINDERS_SECRET` of at least 32 characters and a valid HTTPS root origin in `IUNLOCKMOBILE_PUBLIC_ORIGIN`. Generate/store that signing secret only in the existing root-only server configuration; never in chat, Git, the browser, or a user-facing report. Keep it available while paused so previously issued unsubscribe links remain valid. The normal Whop enabled/live-mode configuration is required for the read-only payment checks. This deployment does not create any activation credentials.

## Recipient and supported payment paths

Use the email persisted on the website bill and verify it belongs to the authenticated active/verified customer or reseller. Do not replace it with the payer email supplied by Whop. Anonymous or unverified guest emails remain excluded from marketing reminders; their explicitly requested transactional links continue as before.

The initial release supports safe card-reminder verification for guest service bills belonging to a verified customer and signed-in Whop credit top-ups. Crypto reminder sends remain fail-closed until an authoritative chain-specific unpaid/in-progress verification adapter is validated; existing crypto checkout, payment watcher and verification are unchanged. A local pending crypto invoice alone is not proof that no transfer was made.

## Sending and settlement safeguards

The reminder verifies the exact hosted checkout/plan/account/environment and checks gateway payment state read-only immediately before eligibility/claim/send. Nonempty/unknown/error/partial gateway results must not be treated as evidence of unpaid status. Re-read local paid/review/in-progress/verification state after asynchronous calls; use durable atomic claims and a separate accepted marker, stable Resend idempotency key, bounded lifetime and ambiguity quarantine. The reminder must never charge cards, add credit, dispatch Provider work, issue refunds or settle payments itself.

Keep the five-minute reminder marker separate from `checkout_link_sent_at`, which identifies the requested initial email. Preserve that email and link recovery. The private website status link, not a stale direct payment CTA, is the primary reminder destination; it must stop exposing payment after settlement.

Send through the existing Resend server-side mail settings. Include sender identity/postal footer and signed recipient-level unsubscribe. Unsubscribing stops marketing reminders only, not OTP, receipts or necessary result/refund notifications. API acceptance is not delivery, inbox placement, opening, clicking or payment success.

## Deployment and rollback

Build/test from the exact production-based release SHA in a sandbox, using temporary SQLite and empty Provider/Whop/Resend credentials. Do not restore or overwrite the live SQLite to roll back code. Additive reminder tables remain compatible with the previous app and do not alter financial ledger entries.

Before swapping, create a root-only online SQLite backup with checksum, snapshot root-only config/units/Caddy/GSC, retain the previous validated `.next`, and record timer state. Only the already-reviewed stale command-output file and unused `.next-pre-pr*` build directories may move into a root-only, byte-verified quarantine under that backup. Do not delete them or alter the intentional GSC file. Restore quarantined paths as well as code/build if deployment fails.

Use guarded fast-forward only, an atomic build swap and automatic rollback. Stop the existing timer only during swap, wait for its current one-shot process to finish, restart only the app and restore the timer's prior state. Verify health, ledger/hold invariants, config/GSC hashes, protected/anonymous/webhook guards and feature-off state after deployment.
