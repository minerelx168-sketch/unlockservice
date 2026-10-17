import Link from 'next/link'
import { AutoRefreshPaymentStatus } from './invoice-actions'
import { formatUsd } from '@/lib/money'
import { safeWhopCheckoutUrl, type WhopTopup } from '@/lib/whop'

export function WhopInvoice({ topup }: { topup: WhopTopup }) {
  const review = Boolean(topup.review_reason)
  const refunded = topup.status === 'refunded'
  const settled = Boolean(topup.credited)
  const failed = topup.status === 'failed'
  const title = review ? 'Payment needs review' : refunded ? 'Payment refunded' : settled ? 'Credit added' : failed ? 'Payment did not complete' : 'Complete your card payment'
  const checkout = topup.checkout_url && !settled && !refunded && !review
    ? safeWhopCheckoutUrl(topup.checkout_url, topup.environment) : null
  return <section className="panel">
    <header><h1>{title}</h1></header>
    <div className="panel-body">
      <p>iUnlockMobile service credits · {formatUsd(topup.credit_amount_cents)} USD</p>
      <p className="t-small">Payment reference: {topup.invoice_reference}</p>
      {review ? <p role="status">Please contact support about this payment. New service orders are paused while it is reviewed.</p>
        : refunded ? <p>This payment has been refunded. Refunded credits cannot be spent.</p>
        : settled ? <p>Your payment has been verified and credited to your account.</p>
        : failed ? <p>Your card payment did not complete. You can retry securely on Whop.</p>
        : <p>Pay securely on Whop. Credit appears after payment verification, even if you close the checkout page.</p>}
      {topup.reversed_cents > 0 ? <p>Credit removed after refund: {formatUsd(topup.reversed_cents)}</p> : null}
      {checkout ? <a className="button button--accent" href={checkout} rel="noreferrer">Pay on Whop</a> : null}
      {!settled && !refunded && !review ? <AutoRefreshPaymentStatus active /> : null}
      <p><Link href="/user/payments">Payment history</Link> · <Link href="/user/services/unlock">Browse services</Link> · <Link href="/contact">Contact support</Link></p>
    </div>
  </section>
}
