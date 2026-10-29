import {ResellerApiDocs} from '@/components/reseller-api-docs'
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
export const metadata:Metadata={title:'Reseller Mode'}
export const dynamic='force-dynamic'
export default async function ResellerPage() {
  const {user,session}=await requireSession(),active=user.account_type==='reseller'
  const services=resellerServices(),ledger=active?resellerLedger(user.id).transactions:[],deliveries=active?webhookDeliveries(user.id):[]
  return <div className="reseller-page">
    <div className="app-head"><div><span className="eyebrow">For stores and developers</span><h1>Reseller Mode</h1><p>One wallet. Your prices. Orders and results in one account.</p></div><span className="badge">{accountRole(user.account_type)}</span></div>
    <nav className="reseller-section-nav" aria-label="Reseller sections"><a href="#api-docs">API Docs</a><a href="#api-endpoints">Endpoints</a><a href="#reseller-prices">Service prices</a></nav>
    <section className="panel reseller-intro"><div className="panel-body">
      <h2>{active?'Reseller Mode is active.':'Become a Reseller'}</h2>
      <p>{active?'Your reseller status is permanent. There is no ongoing $100 top-up requirement. Use reseller prices on our website or connect your store through the API.':<><strong>Make one verified top-up of $100 USD or more to activate Reseller Mode permanently.</strong> This is a one-time requirement. After activation, future top-ups can be any amount within the usual payment limits.</>}</p>
      {!active?<p className="t-small">Payment fees do not count toward $100. Smaller top-ups are not combined. Your payment becomes wallet credit to spend on services.</p>:null}
      <div className="reseller-actions"><Link className="button button--primary" href={active?'/user/add-funds':'/user/add-funds?reseller=1'}>{active?'Add funds':'Top up $100 & activate'}</Link><Link className="button button--quiet" href="/user/reports/new">{active?'Order at reseller prices':'Browse services'}</Link><Link className="button button--quiet" href="/user/reports">Service history</Link></div>
      <p className="reseller-balance">Available wallet <strong>{formatUsd(user.credit_cents-user.held_cents)} USD</strong></p>
      <p className="t-small">Orders deduct available wallet funds immediately. A confirmed provider rejection returns the full order amount automatically. Uncertain provider responses stay reserved for review.</p>
    </div></section>
    {active?<ResellerSettings csrfToken={session.csrfToken} keys={listResellerKeys(user.id)} webhook={resellerWebhookSettings(user.id)}/>:null}
    <ResellerApiDocs/>
    <section className="panel" id="reseller-prices"><header><h2>Service prices</h2><span>USD · {services.length} available services</span></header><div className="panel-body">
      <p>Reseller price = retail price minus half of the retail gross profit, rounded up to the next cent. Final prices are confirmed when an order is accepted.</p>
      <ResellerPrices services={services}/>
    </div></section>
    {active?<><section className="panel"><header><h2>Wallet transactions</h2></header><div className="panel-body reseller-table-scroll"><table className="reseller-table"><thead><tr><th>Type</th><th>Amount</th><th>Available after</th><th>Date</th></tr></thead><tbody>{ledger.map(t=><tr key={t.id}><td>{t.type}<small>{t.ref_type} {t.ref_id}</small></td><td>{formatUsd(t.amount_cents)}</td><td>{formatUsd(t.balance_after_cents)}</td><td><LocalTime value={t.created_at}/></td></tr>)}</tbody></table>{!ledger.length?<p>No transactions yet.</p>:null}</div></section>
      <section className="panel"><header><h2>Recent webhook deliveries</h2></header><div className="panel-body"><ul className="reseller-deliveries">{deliveries.map(e=><li key={e.id}><Link href={`/user/reports/${e.order_id}`}>Order #{e.order_id}</Link><span>{e.event} · {e.sent_at?'Delivered':!e.endpoint_active?'Endpoint changed or disabled':e.attempts>=12?'Retries exhausted':e.last_error?'Retry scheduled':'Queued'} · {e.attempts} attempts</span></li>)}</ul>{!deliveries.length?<p>No result events yet. Enable a webhook before placing an order.</p>:null}</div></section></>:null}
  </div>
}
