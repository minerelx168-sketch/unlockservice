# Free IMEI Check Design

## Scope

The first implementation adds a free IMEI check without invoices, credit holds, payment settlement, or unlock-order side effects. It uses the existing unlockservice authentication, SQLite, IMEI validation, rate-limit, provider boundary, and masked identifier conventions.

## Tables

`imei_checks` stores one row per submitted check. It records the owner, check type, a one-way IMEI fingerprint, provider/status metadata, a masked identifier, a JSON report, and timestamps. The raw IMEI is not persisted in the first provider-neutral implementation.

`imei_checks` must allow repeated checks. There is no uniqueness constraint on user + fingerprint; re-checks create new records. A separate idempotency key is optional and only prevents replay of the same client request when supplied.

## Statuses

`queued` means accepted by the application but not yet processed. `completed` means a report is available. `unavailable` means the provider could not return a report. The current mock provider returns a clearly labelled demo report; production must not present it as carrier or GSMA data.

## Security invariants

The server validates a normalized 15-digit Luhn-valid IMEI. The server owns the check type and result; the browser cannot submit a price or provider result. Every create/read request requires a valid session. A user can read only their own checks, while an administrator may read summary data through existing admin boundaries. A per-user SQLite rate-limit bucket limits abuse without preventing later re-checks. Raw IMEIs are never written to logs or response payloads; UI uses a masked identifier.

## Routes

`POST /api/imei/checks` creates one free check. `GET /api/imei/checks` lists the current user's checks. `GET /api/imei/checks/[id]` returns one owned report. A future paid specialized check may reuse the same model with an invoice reference, but this first feature does not touch payment or credit modules.

## UI

The public landing page adds a separate Phone Check panel rather than changing the existing Unlock Phone form. A signed-out visitor can read the panel and is sent to login/register before submission. An authenticated user can submit and see a report. The account shell adds a `Checks` route alongside Unlock and Orders.

## Production configuration

Set `IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET` to a randomly generated value in the root-only production EnvironmentFile. It is used only as the HMAC key for stable IMEI fingerprints and must never be committed. The current `local-validation` adapter makes no network request. When a Provider API is available, add a new `ImeiCheckProvider` implementation in `lib/imei-check-provider.ts`, select it through environment configuration, and keep raw provider payloads out of logs and public responses.
