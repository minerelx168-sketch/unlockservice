# Display audit — 29 October 2026 (Asia/Bangkok)

## Coverage and limits
Reviewed the live public, signed-in and admin surfaces below before this release. Checked the mobile layout at 390 px, document overflow, major controls/headings and visible error strings. Inspected the 45 page-template route inventory and performed focused source checks of shared descriptions, example rendering, identifiers and public copy.

Desktop routes: /, /services, /services/imei-check, /services/unlock, /check, /support, /contact, /terms, /privacy, /track, /articles, /user/dashboard, /user/check, /user/checks, /user/services/unlock, /user/reports, /user/add-funds, /user/payments, /user/orders, /user/profile, /admin, /admin/guest-orders, /admin/payments, /admin/analytics.

Mobile routes: /, /services/imei-check, /services/unlock, /check, /user/check, /user/services/unlock, /user/add-funds, /user/checks, /user/payments, /user/orders, /user/reports, /admin, /admin/payments, /admin/analytics.

No document-wide horizontal overflow or application-error screen was observed on those routes. This is not proof of all payment, email, account or provider-result states. No real payments or provider orders were submitted. Guest authentication and private dynamic result URLs still require targeted post-deployment QA. Browser access disconnected before release.

## Confirmed problems addressed in this PR
- Provider comparison tables (including Apple Carrier Lite) were flattened into long pipe-separated paragraphs. Shared escaped rendering restores complete known tables in the workspace, public hero selector, public catalog, free-check paid catalog and checkout. Unknown or incomplete data stays verbatim.
- Example/provider-output text needed a readable field layout on small screens. Shared output rendering preserves values and colours only an explicit Clean value.
- The ServiceBrowser public catalog always required a 15-digit IMEI, including services configured for Serial, phone, Case ID, UDID or ECID. It now uses the existing product identifier schema. The separate HeroPriceCheck form already used this schema.
- The free-check page displayed an allowance to admin accounts even though the server rejects them. It now distinguishes eligible customers, unverified customers and admin accounts before submission.
- Free-check history navigation and page titles were ambiguous; paid report tables called every identifier IMEI.
- The services hub still called Apple Free Check Basic IMEI validation.
- Privacy copy described local format checks but omitted the provider request made by Apple Free Check. Copy now explains the actual data flow.
- Contact copy implied all refusals return account credit automatically. It now matches the existing Terms distinctions for card, account credit and crypto.
- Public steps only mentioned IMEI although the catalog also accepts other identifier types. Steps now defer to the selected service.
- Tracking copy promised no refresh was needed without support in the tracking form. The unverified promise was removed.

## Outstanding verification
- The footer shows Bitcoin while published crypto instructions describe USDT/USDC on BNB Smart Chain. Confirm whether a real Bitcoin route is available before adding or removing a payment-method claim.
- Catalog entries without a reviewed provider example intentionally have no example button. Do not invent examples or reinterpret ambiguous numeric values as Clean.
- Provider data accuracy and each service's actual returned fields must be verified against authorized real provider results; display checks alone cannot establish them.
- Final desktop/mobile visual QA and release health checks remain pending because the originating browser connection became unavailable.

## Validation
- Shared renderer and identifier changes at f08daf3: lint, typecheck, 383 tests and production build passed in GitHub Actions (run 40733561061).
- An isolated build at that same commit completed successfully on the Cloud Computer.
- Later navigation/copy updates require the final PR-head CI check before merge.
- Production was not changed during the audit.
