# Unlock catalog browsing

`/services/unlock` is an IMEI entry page. It never loads the product catalog or passes product names, prices or codes into HTML or the React Server Component payload. A saved draft may prefill the IMEI, but does not skip this page.

Submitting **Show unlock services** validates the full 15-digit IMEI and checksum on the server, writes the existing 15-minute HttpOnly device-intent cookie, and redirects to `/services/unlock/catalog`. The homepage Unlock form uses the same handoff. IMEIs are not placed in navigation URLs. Phone Check still supports browsing without an IMEI.

The catalog route validates the unexpired Unlock intent before constructing product props. Missing, malformed, expired or Phone Check intents return to the entry page. The catalog keeps the IMEI read-only with a **Change IMEI** link; selecting a service retains the existing sign-in, review and funding flow. Browsing does not call the provider, create an order or change credit.

The catalog is absent from the sitemap and sends `noindex, nofollow, noarchive` metadata and an `X-Robots-Tag` header, including for RSC/prefetch responses. Responses are private and not stored by shared caches. Do not block this route in `robots.txt`: compliant search engines need to fetch it to see `noindex`. The generic entry page remains indexable. The same rules apply to all visitors, without user-agent detection or alternate crawler content.

This is an interaction step and an indexing preference, not authentication or a guarantee against automated browsing. The existing draft cookie is unsigned; IMEI format/checksum validation does not prove device ownership, eligibility or the authenticity of a device. Automated clients can submit a valid-format number. Public marketing pages and articles are not globally rewritten or removed by this change. See [Google's robots.txt limitations](https://developers.google.com/search/docs/crawling-indexing/robots/intro) and [noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

## Verification

Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`. Browser checks should cover entry and catalog at 320, 440, 768, 1024 and 1440 CSS pixels; direct catalog requests with missing/invalid/expired/wrong-domain intent; regular HTML and RSC/prefetch responses; invalid IMEI errors with and without JavaScript; valid handoff; changing IMEI; service previews; and service selection through sign-in and funding without submitting an order or invoice. Verify served production behavior separately after deployment.
