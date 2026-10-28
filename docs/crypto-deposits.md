# Crypto deposits

The Add funds Crypto option opens a native, keyboard-accessible modal: amount
(default $10), Binance-Peg USDT/BSC-USD or USDC on BNB Smart Chain, then the
receiving-address QR, exact coded amount and “I have deposited my funds”. An
optional Tx ID follows the same server verifier as automatic detection. The
button requests a check; it never credits by itself. Existing invoices remain
accessible through Payments; new invoices use the same compact status view.

New crypto invoices snapshot `payment_credit_policy=actual_received`. Verified
net tokens are floored to whole USD cents: 9.9937 tokens credits $9.99 and
10.0037 credits $10.00. Subcent identifying digits are not rounded up. The
original requested credit stays in the verification record. Existing requests
retain their prior `legacy_allowance` policy, including reopening one. No
existing balance, invoice price or card fee is rewritten by the migration.

Amounts alone are not ownership evidence on a shared public wallet. Automatic
matching requires the unique invoice code, supported contract, recipient,
network, creation window, canonical successful receipt and required finality.
Nearby amounts are ranked in the admin unmatched-transfer queue; ambiguity or
a rounded-away code requires ownership review. A public Tx ID is a lookup aid,
not authority to claim someone else's payment. Duplicate and batch-event guards
are unchanged. The API requires the owning session, CSRF and rate limits.

BNB RPC remains the authoritative complete range scan and receipt verifier.
Optional BscScan discovery uses Etherscan API V2 `logs/getLogs`, chainid 56,
contract plus recipient Transfer topics, when both these server-only settings
are configured:

- `IUNLOCKMOBILE_BSCSCAN_DISCOVERY=1`
- `IUNLOCKMOBILE_ETHERSCAN_API_KEY` with access to BNB Smart Chain

Explorer results supplement the RPC scan; explorer indexing delays, a full
page, quota errors or missing access cannot skip RPC blocks or create credit.
All resulting candidates still pass fresh on-chain verification. Without a
key, automatic RPC verification and the public BscScan links remain available.
Never put the API key in browser props, URLs exposed to customers, or Git.

Reference: https://docs.etherscan.io/api-reference/endpoint/getlogs

Release verification: simulated chain tests cover exact, short and excess
funds, matching among nearby requests, repeat settlement, unauthorized invoice
reads, explorer failure, wrong token/network/recipient, failed/reorganized
receipts, stolen hashes, expired codes and historical credit policy. A browser
smoke can create an unpaid $10 request; an actual wallet transfer must be made
by the owner and is not implied by opening or checking a request.
