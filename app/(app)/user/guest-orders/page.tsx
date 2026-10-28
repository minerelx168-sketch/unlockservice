import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { listClaimedGuestOrders } from '@/lib/guest-account'
import { guestOrderPath } from '@/lib/guest-checkout'
import { formatUsd } from '@/lib/money'
import { LocalTime } from '@/components/customer-time'
export const dynamic='force-dynamic'
export const metadata={title:'Direct card orders',robots:{index:false,follow:false}}
export default async function GuestOrdersPage() {
  const {user}=await requireSession(),orders=listClaimedGuestOrders(user.id)
  return <><div className="app-head"><div><h1>Direct card orders</h1><p>Your paid direct orders and orders saved from email. Open an order to see its status and result.</p></div><Link className="button button--quiet" href="/user/orders">Account orders</Link></div>
    <div className="panel">{orders.length?<div className="table-wrap"><table className="grid account-table"><thead><tr><th>Service</th><th>Order total before tax</th><th>Placed</th><th>Result</th></tr></thead><tbody>{orders.map(order=><tr key={order.reference}><td data-label="Service">{order.product_name}</td><td data-label="Total">{formatUsd(order.price_cents+order.wallet_credit_cents+order.fee_cents)}</td><td data-label="Placed"><LocalTime value={order.created_at}/></td><td data-label="Result"><Link href={guestOrderPath(order.reference)}>View order</Link></td></tr>)}</tbody></table></div>:<p className="empty">Your paid direct orders will appear here. You can also save a guest order using the account link in its email.</p>}</div></>
}
