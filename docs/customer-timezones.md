# Customer local times

All customer account timestamps under `/user` use the device's IANA timezone, detected with `Intl.DateTimeFormat().resolvedOptions().timeZone`. This covers dashboard activity, order history and details, credit ledger, payment history and request details (card, crypto and legacy), free and paid report lists/details, and profile dates.

Country and IP are not used: a country can have several timezones, and a customer can travel. The browser timezone is refreshed when the window gains focus or the tab becomes visible. Customers can correct their displayed timezone through their device's date/time settings. No timezone is sent to analytics or stored on the account.

`Placed today` also follows the customer's local calendar. A session-scoped read-only query supplies counts grouped by UTC minute for the previous 48 hours (at most 2,881 buckets, without order IDs or device details). The browser counts the local day, including daylight-saving changes, and checks for midnight every minute. Like other dashboard totals, newly placed orders require a refreshed dashboard snapshot.

The interface stays in English with Gregorian dates. Timestamps include the actual GMT offset for that historical instant; the footer identifies the IANA zone. Date-only membership and email-verification fields use the local calendar date. The `time` element preserves the canonical ISO instant, and its tooltip includes the zone and UTC value. Text can wrap on narrow mobile cards.

SQLite timestamps without an offset are interpreted as UTC explicitly. ISO timestamps with `Z` or a numeric offset retain their meaning. Invalid dates render an em dash. Server rendering and the initial browser render both use labelled UTC, followed by device-local time after hydration. Without JavaScript or when timezone detection fails, UTC remains available.

Admin analytics and its CSV exports remain Asia/Bangkok, so changing a customer's device timezone cannot change reporting day boundaries. Existing Admin operational UTC timestamps, persisted timestamps, payment verification, expiry calculations, credit balances, GA4 settings, and article publication calendar dates are unchanged. `Request created` is the time a payment request was opened, not proof of when funds settled.

Example instant: `2026-10-19 06:15:00` UTC appears as Oct 19 at 1:15 PM GMT+7 in Bangkok, Oct 18 at 11:15 PM GMT-7 in Los Angeles, and Oct 19 at 12:00 PM GMT+5:45 in Kathmandu. This is a formatting example, not verification of a specific customer's transaction or GA4 event.

Tests cover timezone-independent UTC parsing, explicit offsets, local date rollover, fractional-hour zones, daylight-saving transitions, malformed dates, and UTC fallback. Browser-based hydration/mobile checks and production installation must still be completed when the connected browser is available.
