# Compact Product Catalog and Checkout Confirmation

## Goal

Reduce purchase friction without weakening Provider, privacy, ownership, or credit safeguards. Catalog pages should support fast comparison and a single obvious action. Delivery estimates belong to the confirmation step immediately before a credit hold and Provider submission, not to the browsing card.

## Catalog card contract

Each card contains only the customer-safe category, availability state, product name, one short summary, fixed USD price, and one full-width action. Cards must not display Provider IDs, raw Provider descriptions, emoji, delivery estimates, or oversized decorative panels. Desktop uses a dense three-column grid when space permits; tablet uses two columns; mobile uses one column. Card content uses consistent minimum heights and the action remains aligned at the bottom.

Available Phone Check cards use **Choose report** and deep-link to the authenticated checkout. Non-orderable products use an honest disabled **Unavailable online** state. Unlock products remain non-orderable until an exact Provider API contract exists. No customer-facing control may imply that an unsupported service can be purchased.

## Checkout confirmation contract

The paid-report form remains owner-scoped and CSRF protected. Selecting a product and entering a valid identifier does not call the Provider. The first action opens a review step containing product name, masked identifier, price, estimated delivery, charge-on-delivery policy, and manual-review/no-auto-retry disclosure. Only the explicit **Confirm and order** action creates the idempotency key, credit hold, order, and one Provider request.

Back/cancel closes the review without creating an order or ledger effect. Insufficient credit is shown before confirmation. Synchronous timeout or uncertain results remain manual review and are never retried automatically.

## Provider activation gates

A product is orderable only when all conditions are true:

1. Its Service ID appears in the live PHP service-list response.
2. The required input type is supported and validated by the customer form.
3. A service-specific report allowlist exists and unknown fields are discarded.
4. Customer price is greater than Provider cost unless the owner explicitly approves a zero-margin price.
5. The Provider response/failure behavior is compatible with hold → charge/refund/manual-review semantics.
6. The deployment mapping exactly matches the canonical Service ID.

The current live PHP API exposes 50 Service IDs. The canonical catalog matches 49; Service ID 988 is newly detected and must be added only after owner pricing and report/input review. Of the 49 matched services, 25 are currently active, 18 have positive margin but still require one or more input/report/failure-policy validations, and 6 have zero margin. The remaining 80 catalog products are not present in the PHP API service list and must remain view-only unless the Provider supplies a documented API contract.

## Acceptance criteria

Catalog browsing creates no order, hold, ledger entry, or Provider event. ETA is absent from catalog cards and present in checkout review. Available cards have one primary action. Tests cover cancellation with zero financial effects, explicit confirmation, exact mapping, idempotency, owner scope, and unchanged hold → charge/refund/manual-review behavior.
