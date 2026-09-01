# Provider Product Catalog Rollout

## Objective

Production will publish the owner's current **Unlock** and **IMEI Check** catalog without representing unsupported services as orderable. The customer-facing catalog is separate from the execution boundary: visibility does not imply Provider readiness.

## Source and reconciliation

The catalog source is the 129-row IMEI Order selector captured from the authenticated `unlock-service.net` UI on 2026-09-01, joined to the owner-supplied `Selling_price-ชีต1.csv`. All 129 rows matched, 117 prices are above Provider cost, 12 equal Provider cost, and none are below cost.

| Status | Count | Production behavior |
|---|---:|---|
| Available paid IMEI reports | 25 | Positive margin, IMEI input, PHP Instant API, service mapping, service-specific report allowlist, and `Instant` delivery metadata |
| Coming soon | 84 | Visible in the catalog but not orderable; includes Unlock products without a confirmed PHP API contract, serial/phone input services, and IMEI services that lack a safe execution/report contract |
| Reprice | 12 | Hidden from the customer catalog until a price above cost is approved |
| Restricted | 8 | Hidden; sensitive owner/phone/iCloud-ID lookup products require a separate privacy/legal approval |

The public catalog therefore exposes 109 products: 25 available IMEI reports and 84 coming-soon products across IMEI Check and Unlock. Server Services remain outside scope.

## Execution and financial policy

Available IMEI reports continue to use the paid-report aggregate and the existing append-only credit ledger. Submission requires an authenticated owner, CSRF token, idempotency key, valid 15-digit IMEI, sufficient available credit, a positive-margin active product, an enabled HTTPS Provider, and an exact service mapping. The lifecycle remains `hold → charge` only after a usable allowlisted report, `hold → refund` on explicit terminal failure, and `manual_review` with the hold retained for ambiguous synchronous failures. Automatic retry is prohibited.

Unlock products are catalog-only in this rollout because the authenticated Provider PHP service list exposes no Unlock/Removal/Carrier Unlock entries. Their UI-only IDs must not be placed through browser automation or guessed against the PHP endpoint. The existing mock/placeholder Unlock catalog must not accept production money; production maintenance mode remains enforced for that domain.

## Privacy and report policy

Only service-specific allowlisted fields are stored in paid reports. IMEI, IMEI2, MEID and serial values are masked. Raw Provider payloads, API keys, endpoint URLs and request bodies are not stored in reports or audit metadata. Unknown fields are discarded. A completed Provider response with no supported public fields is routed to manual review rather than charged/delivered.

## Activation gates

The product catalog file may contain all 129 reviewed rows, but `available` is permitted only when all of the following are true: positive margin; non-sensitive product; correct input validator; confirmed PHP API presence; synchronous `Instant` metadata; stable product code; exact service ID mapping; and a service-specific report allowlist. Changes to price or Provider cost never silently activate a product. Production activation remains database- and environment-controlled and must keep the number of active products equal to the number of active mappings.

## Deployment verification

Before deployment, run unit/integration tests, typecheck, lint, diff check, secret scan and a production build with a separate SQLite database and Provider disabled. Before applying an additive catalog migration, create an online SQLite backup with a SHA-256 sidecar. After deployment, verify active product/mapping parity, owner isolation, SQLite integrity, credit-ledger mismatches, held-credit invariants, raw-identifier absence, HTTPS health, and that no Provider request was created by catalog browsing.
