import {ResellerPrices} from '@/components/reseller-prices'
import Link from 'next/link'
import type {Metadata} from 'next'
import {requireSession} from '@/lib/auth'
import {formatUsd} from '@/lib/money'
import {accountRole} from '@/lib/reseller-pricing'
import {listResellerKeys,resellerServices,resellerLedger} from '@/lib/reseller'
import {resellerWebhookSettings,webhookDeliveries} from '@/lib/reseller-webhooks'
import {ResellerSettings} from '@/components/reseller-settings'
import {LocalTime} from '@/components/customer-time'
export const metadata:Metadata={title:'Reseller API'}
export const dynamic='force-dynamic'
const sample=`curl https://iunlockmobile.com/api/reseller/v1/orders \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Idempotency-Key: my-store-order-000001" \\
  -H "Content-Type: application/json" \\
  -d '{"service_code":"SERVICE_CODE_FROM_CATALOG","identifier":"YOUR_CUSTOMER_IMEI","expected_price_cents":800,"accepted_terms":true}'`
export default async function ResellerPage() {
  const {user,session}=await requireSession(),active=user.account_type==='reseller'
  const services=resellerServices(),ledger=active?resellerLedger(user.id).transactions:[],deliveries=active?webhookDeliveries(user.id):[]
  return <div className="reseller-page">
    <div className="app-head"><div><span className="eyebrow">For stores and developers</span><h1>Reseller API</h1><p>One wallet. Your prices. Orders and results in one account.</p></div><span className="badge">{accountRole(user.account_type)}</span></div>
    <section className="panel reseller-intro"><div className="panel-body">
      <h2>{active?'Your reseller account is active.':'Become a reseller with one $100 top-up.'}</h2>
      <p>{active?'Your reseller status is permanent. Use the same prices on our website or connect your store through the API.':'Add at least $100 USD of wallet credit in one verified payment. Reseller access activates automatically and stays active even after you spend the balance. Fees do not count toward $100; smaller payments are not added together.'}</p>
      <div className="reseller-actions"><Link className="button button--primary" href="/user/add-funds?reseller=1">{active?'Add funds':'Top up $100'}</Link><Link className="button button--quiet" href="/user/reports/new">{active?'Order at reseller prices':'Browse services'}</Link><Link className="button button--quiet" href="/user/reports">Service history</Link></div>
      <p className="reseller-balance">Available wallet <strong>{formatUsd(user.credit_cents-user.held_cents)} USD</strong></p>
      <p className="t-small">Orders deduct available wallet funds immediately. A confirmed provider rejection returns the full order amount automatically. Uncertain provider responses stay reserved for review.</p>
    </div></section>
    {active?<ResellerSettings csrfToken={session.csrfToken} keys={listResellerKeys(user.id)} webhook={resellerWebhookSettings(user.id)}/>:null}
    <section className="panel"><header><h2>Service prices</h2><span>USD · {services.length} available services</span></header><div className="panel-body">
      <p>Reseller price = retail price minus half of the retail gross profit, rounded up to the next cent. Final prices are confirmed when an order is accepted.</p>
      <ResellerPrices services={services}/>
    </div></section>
    <section className="panel"><header><h2>API quick start</h2></header><div className="panel-body reseller-docs">
      <p>Base URL: <code>https://iunlockmobile.com/api/reseller/v1</code>. Use <code>Authorization: Bearer YOUR_API_KEY</code> from your server.</p>
      <dl><div><dt>GET /balance</dt><dd>Available USD wallet balance.</dd></div><div><dt>GET /services</dt><dd>Available services, prices, required identifier and delivery estimate.</dd></div><div><dt>POST /orders</dt><dd>Submit one prepaid order. Copy the current service code and price from /services.</dd></div><div><dt>GET /orders and /orders/ID</dt><dd>Your order status, full result and raw result. Lists accept ?before=ID for the next page.</dd></div><div><dt>GET /transactions</dt><dd>Immutable wallet transactions; accepts ?before=ID.</dd></div></dl>
      <pre>{sample}</pre>
      <p><strong>Reuse the same Idempotency-Key when retrying.</strong> A timeout does not mean the order failed. Never generate a second key for the same customer order. A different order with the same key returns 409.</p>
      <p>IMEI services require 15 digits and a valid Luhn checksum. Other services accept the identifier type shown in the catalog. Confirm device authorization and service terms with your customer before sending <code>accepted_terms: true</code>.</p>
      <p>Statuses: <code>processing</code>, <code>completed</code>, <code>refunded</code>, <code>manual_review</code>. Insufficient funds returns 402. Limits: 120 API requests/minute and 600 new orders/hour per account. A 429 response includes Retry-After.</p>
      <details><summary>Verify result webhooks</summary><p>Events: <code>order.completed</code> and <code>order.refunded</code>. Verify HMAC-SHA256 with your signing secret over <code>event_id.timestamp.raw_body</code>. Compare with the hex value after <code>sha256=</code> in X-IUnlockMobile-Signature using a constant-time comparison. Read the ID and timestamp from X-IUnlockMobile-Event-Id and X-IUnlockMobile-Timestamp.</p><p>Reject timestamps older than 5 minutes. Deduplicate by event ID and return a 2xx response promptly. Delivery retries up to 12 attempts with backoff. If unavailable, retrieve the order through the API. Endpoint must resolve to public IPv4; HTTPS port 443 only; redirects are refused.</p></details>
    </div></section>
    {active?<><section className="panel"><header><h2>Wallet transactions</h2></header><div className="panel-body reseller-table-scroll"><table className="reseller-table"><thead><tr><th>Type</th><th>Amount</th><th>Available after</th><th>Date</th></tr></thead><tbody>{ledger.map(t=><tr key={t.id}><td>{t.type}<small>{t.ref_type} {t.ref_id}</small></td><td>{formatUsd(t.amount_cents)}</td><td>{formatUsd(t.balance_after_cents)}</td><td><LocalTime value={t.created_at}/></td></tr>)}</tbody></table>{!ledger.length?<p>No transactions yet.</p>:null}</div></section>
      <section className="panel"><header><h2>Recent webhook deliveries</h2></header><div className="panel-body"><ul className="reseller-deliveries">{deliveries.map(e=><li key={e.id}><Link href={`/user/reports/${e.order_id}`}>Order #{e.order_id}</Link><span>{e.event} · {e.sent_at?'Delivered':!e.endpoint_active?'Endpoint changed or disabled':e.attempts>=12?'Retries exhausted':e.last_error?'Retry scheduled':'Queued'} · {e.attempts} attempts</span></li>)}</ul>{!deliveries.length?<p>No result events yet. Enable a webhook before placing an order.</p>:null}</div></section></>:null}
  </div>
}
