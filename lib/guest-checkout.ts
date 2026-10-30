import { alreadyHandled, checkoutContext, claimEvent, ga4Config, identity, isInternalEmail, markDeliveryStarted, sendClaimedEvent, skipEvent, toMicros } from './ga4'
import { marginCents, serviceForCode } from './service-margins'
import { customerTypeFor } from './purchase-analytics'
import { logPaymentFailure } from './payment-diagnostics'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Whop } from '@whop/sdk'
import { db } from './db'
import { guestCardQuote } from './guest-card-quote'
import { parseUsd } from './money'
import { serviceIdentifier, identifierField } from './service-identifier'
import { decryptPaidReportImei, encryptPaidReportImei } from './paid-report-imei'
import { createPaidReport, getPaidReport, getPaidReportProduct, PaidReportError } from './paid-reports'
import { credit, getBalance, hasCreditTransition } from './credits'
import { emailDeliveryConfigured, sendTransactionalEmail } from './account-security'
import { client, reconcileGuestPaymentBeforeSettlement, whopCheckoutEnabled, whopConfiguration, safeWhopCheckoutUrl, WhopPaymentError } from './whop'
import { publicOrigin } from './site'
import { consumeAttempt } from './rate-limit'
import { prepareGuestAccount } from './guest-account'
import { settleGuestCryptoPayment } from './guest-crypto'

// Verified against the live Whop create-checkout API: minimum plan total is USD 1.00.
export const GUEST_CARD_MIN_TOTAL_CENTS = 100

export type GuestCheckout = {
  reference: string; request_key: string; email: string; product_code: string; product_name: string
  imei_encrypted: string; card_order_price_cents: number | null; tax_cents: number; checkout_link_sent_at: string | null; checkout_link_next_at: number; price_cents: number; fee_cents: number; wallet_credit_cents: number; customer_user_id: number | null; wallet_review_reason: string | null; account_id: string; product_id: string
  environment: string; checkout_id: string | null; plan_id: string | null; checkout_url: string | null
  payment_method: 'card' | 'crypto'; crypto_invoice_reference: string | null
  payment_id: string | null; state: string; user_id: number | null; report_id: number | null
  paid_at: string | null; processor_updated_at: string | null; review_reason: string | null; last_error: string | null
  refund_requested_at: string | null; refund_notice_sent_at: string | null; receipt_sent_at: string | null; result_sent_at: string | null
  email_attempts: number; email_next_at: number; client_id: string | null; session_id: string | null
  analytics_state: string; created_at: string
}
/** Legacy rows keep their promised wallet allocation; new direct orders have none. */
export function guestCheckoutTotal(row: Pick<GuestCheckout, 'card_order_price_cents' | 'price_cents' | 'wallet_credit_cents' | 'fee_cents'>) {
  return (row.card_order_price_cents ?? row.price_cents + row.wallet_credit_cents) + row.fee_cents
}

export function guestCheckoutCoreEnabled() {
  return process.env.IUNLOCKMOBILE_GUEST_CHECKOUT_ENABLED === '1' && emailDeliveryConfigured()
    && (process.env.IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET?.trim().length ?? 0) >= 32
}
export function guestCheckoutEnabled() { return guestCheckoutCoreEnabled() && whopCheckoutEnabled() }
function linkKey(reference: string) {
  const secret = process.env.IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET?.trim()
  if (!secret || secret.length < 32) throw new Error('Guest order links unavailable.')
  return createHmac('sha256', secret).update(`guest-order:v1:${reference}`).digest('hex')
}
export function guestOrderPath(reference: string) {
  return `/checkout/result/${reference}?key=${linkKey(reference)}`
}
export function getGuestCheckout(reference: string): GuestCheckout | undefined {
  return db().prepare('SELECT * FROM guest_checkouts WHERE reference=?').get(reference) as GuestCheckout | undefined
}
export function authorizedGuestCheckout(reference: string, key: string) {
  if (!/^[a-f0-9]{32}$/.test(reference) || !/^[a-f0-9]{64}$/.test(key)) return undefined
  if (!timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(linkKey(reference), 'hex'))) return undefined
  return getGuestCheckout(reference)
}

export async function createGuestCheckout(input: {
  productCode: string; imei: string; email: string; requestKey: string; expectedPriceCents: number; authenticatedUserId?: number
  analytics?: { clientId: string; sessionId: string }
}) {
  const config = whopConfiguration()
  if (!config || !guestCheckoutEnabled()) throw new WhopPaymentError('Guest checkout is temporarily unavailable.', 503)
  const inputProduct = getPaidReportProduct(input.productCode)
  const inputType = inputProduct?.inputType ?? 'imei'
  const email = input.email.trim().toLowerCase(), imei = serviceIdentifier(input.imei, inputType)
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new WhopPaymentError('Enter a valid delivery email.')
  if (!imei) throw new WhopPaymentError(identifierField(inputType).error)
  if (!/^[a-f0-9-]{32,64}$/i.test(input.requestKey)) throw new WhopPaymentError('Reload the checkout and try again.')
  const row = db().transaction(() => {
    const existing = db().prepare('SELECT * FROM guest_checkouts WHERE request_key=?').get(input.requestKey) as GuestCheckout | undefined
    if (existing) {
      if (existing.customer_user_id !== null && !input.authenticatedUserId) throw new WhopPaymentError('Sign in to continue this card checkout.',401)
      if (existing.email !== email || existing.product_code !== input.productCode || decryptPaidReportImei(existing.imei_encrypted) !== imei
        || existing.price_cents !== input.expectedPriceCents || (existing.customer_user_id !== null && existing.customer_user_id !== input.authenticatedUserId) || existing.payment_method !== 'card' || existing.account_id !== config.accountId || existing.environment !== config.mode) {
        throw new WhopPaymentError('This checkout belongs to a different selection. Reload to start a new order.', 409)
      }
      if (existing.customer_user_id !== null) {
        const valid=db().prepare("SELECT 1 FROM users WHERE id=? AND account_type IN ('customer','reseller') AND status='active' AND banned_at IS NULL AND email_verified_at IS NOT NULL AND lower(email)=?").get(input.authenticatedUserId,email)
        if (!valid) throw new WhopPaymentError('Sign in to the customer account for this order.',401)
        if (existing.state==='pending' && (db().prepare('SELECT 1 FROM guest_checkouts WHERE customer_user_id=? AND wallet_review_reason IS NOT NULL LIMIT 1').get(existing.customer_user_id)
          || db().prepare('SELECT 1 FROM whop_topups WHERE user_id=? AND review_reason IS NOT NULL LIMIT 1').get(existing.customer_user_id))) throw new WhopPaymentError('A payment on this account needs review. Contact support before paying again.',409)
      }
      return existing
    }
    const product = getPaidReportProduct(input.productCode)
    if (!product?.providerReady || product.priceCents <= 0 || product.priceCents > 100000) throw new WhopPaymentError('This service is not available for online payment.', 409)
    const quote = guestCardQuote(product.priceCents)
    if (product.priceCents !== input.expectedPriceCents) throw new WhopPaymentError('The price changed. Reload to review the current price.', 409)
    if (!consumeAttempt('guest-checkout-email', email, 6, 3600)) throw new WhopPaymentError('Too many requests. Please try again later.', 429)
    const reference = randomBytes(16).toString('hex')
    const a = input.analytics
    const validAnalytics = a && /^\d{1,20}\.\d{1,20}$/.test(a.clientId) && /^\d{1,12}$/.test(a.sessionId) && Number(a.sessionId)>0
    db().prepare(`INSERT INTO guest_checkouts (reference,request_key,email,product_code,product_name,imei_encrypted,price_cents,fee_cents,
      account_id,product_id,environment,client_id,session_id,wallet_credit_cents,customer_user_id,card_order_price_cents) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      reference,input.requestKey,email,product.code,product.name,encryptPaidReportImei(imei,product.inputType),product.priceCents,quote.feeCents,
      config.accountId,config.productId,config.mode,validAnalytics ? a.clientId : null, validAnalytics ? a.sessionId : null,0,null,quote.fundingCents)
    return getGuestCheckout(reference)!
  }).immediate()
  if (row.state !== 'pending') return { url: guestOrderPath(row.reference), reference: row.reference }
  if (row.checkout_url) return { url: row.checkout_url, reference: row.reference }
  const total = guestCheckoutTotal(row)
  const checkout = await client(config).checkoutConfigurations.create({
    account_id: config.accountId, mode: 'payment',
    plan: { account_id: config.accountId, product_id: config.productId, currency: 'usd',
      ...(row.card_order_price_cents !== null ? { override_tax_type: 'inclusive' } : {}),
      initial_price: total / 100, plan_type: 'one_time', renewal_price: 0,
      // Whop variants accept a maximum 30-character title; retain the complete service in the description.
      title: row.product_name.slice(0,30), description: row.wallet_credit_cents > 0 ? `${row.product_name}. One device service order. Service $${(row.price_cents/100).toFixed(2)}, account credit $${(row.wallet_credit_cents/100).toFixed(2)}, card fee $${(row.fee_cents/100).toFixed(2)}. No subscription.` : `iUnlockMobile — ${row.product_name}. One device service order. Total $${(total/100).toFixed(2)} USD, including our card fee and any applicable tax. No subscription.`,
      visibility: 'hidden', unlimited_stock: true, force_create_new_plan: true, three_ds_level: 'mandate_challenge',
      payment_method_configuration: { enabled: ['card'], disabled: [], include_platform_defaults: false } },
    metadata: { guest_reference: row.reference, order_id: row.reference, integration: 'iunlockmobile-guest-v1' },
    payment_method_configuration: { enabled: ['card'], disabled: [], include_platform_defaults: false },
    redirect_url: publicOrigin() + guestOrderPath(row.reference),
  }, { idempotencyKey: `guest-checkout-${row.reference}` })
  if (!checkout.purchase_url || !/^ch_[A-Za-z0-9]+$/.test(checkout.id) || checkout.account_id !== config.accountId
    || checkout.plan?.plan_type !== 'one_time' || checkout.plan.currency !== 'usd' || Math.round(checkout.plan.initial_price*100)!==total) {
    throw new WhopPaymentError('Payment checkout could not be verified. Please try again.',502)
  }
  const url = safeWhopCheckoutUrl(checkout.purchase_url, config.mode)
  db().prepare('UPDATE guest_checkouts SET checkout_id=?,plan_id=?,checkout_url=? WHERE reference=? AND checkout_id IS NULL')
    .run(checkout.id,checkout.plan.id,url,row.reference)
  return { url, reference: row.reference }
}
function money(value: Whop.Money | null | undefined, optional=false) {
  if (!value && optional) return 0
  if (!value || value.currency!=='usd' || value.decimals!==2) throw new Error('Unexpected payment currency.')
  const result=parseUsd(value.amount)
  if (result===null || !Number.isSafeInteger(result) || result<0) throw new Error('Unexpected payment amount.')
  return result
}
function guestPaymentIdentityMatches(row: GuestCheckout, payment: Whop.Payment, config: NonNullable<ReturnType<typeof whopConfiguration>>) {
  return row.account_id===payment.account_id && row.environment===config.mode && row.product_id===payment.product_id
    && row.plan_id===payment.plan_id && row.checkout_id===payment.checkout_configuration_id
    && payment.metadata?.integration==='iunlockmobile-guest-v1' && payment.metadata?.guest_reference===row.reference
}
export function guestPaymentIsSettled(payment: Whop.Payment) {
  if (['refunded','auto_refunded'].includes(payment.substatus)) return true
  if (payment.status!=='paid') return false
  return ['succeeded','partially_refunded','dispute_won','dispute_warning_closed','resolution_won'].includes(payment.substatus)
    || /dispute|resolution/.test(payment.substatus)
}
function guestPaymentAmounts(row: GuestCheckout, payment: Whop.Payment) {
  const total=money(payment.total), subtotal=money(payment.subtotal), tax=money(payment.tax_amount,true), refunded=money(payment.refunded_amount,true)
  const expectedTotal=guestCheckoutTotal(row)
  // New inclusive quotes fix the amount collected; legacy exclusive quotes retain their contract.
  const validAmount=row.card_order_price_cents !== null
    ? total===expectedTotal && tax<=total && (subtotal===total || subtotal===total-tax)
      && (tax===0 || payment.tax_behavior==='inclusive')
    : subtotal===expectedTotal && total-tax===subtotal && total>=subtotal && (tax===0 || payment.tax_behavior==='exclusive')
  if (payment.currency!=='usd' || !validAmount || refunded>total || payment.payment_method_type!=='card'
    || payment.promo_code_id || !['one_time','subscription_create'].includes(payment.billing_reason??'')) throw new Error('Guest payment amount mismatch.')
  return { total, tax, refunded }
}
export function guestPaymentQuoteMatches(row: GuestCheckout, payment: Whop.Payment) {
  try { guestPaymentAmounts(row,payment); return true } catch { return false }
}
function guestPaymentHasNoCollectedFunds(payment: Whop.Payment) {
  if (payment.paid_at===null) return true
  const paidAt=Date.parse(payment.paid_at), createdAt=Date.parse(payment.created_at)
  // Failed Whop receipts can expose a pre-creation sentinel in paid_at. It is
  // not collection proof and must never authorize a paid settlement.
  return Number.isFinite(paidAt) && Number.isFinite(createdAt) && paidAt<createdAt
}
function guestPaymentIsDefinitelyFailed(payment: Whop.Payment) {
  const terminal=['failed','blocked','canceled','uncollectible'].includes(payment.substatus)
  return terminal && ((payment.status==='open' && payment.substatus!=='uncollectible')
    || payment.status==='void' || payment.status==='uncollectible')
}
/** Proof-only check used by the async Whop worker before clearing a prior ID. */
export function guestPaymentCanClearPriorBinding(row: GuestCheckout, payment: Whop.Payment) {
  const config=whopConfiguration()
  if (!config || !/^pay_[A-Za-z0-9]+$/.test(payment.id) || !guestPaymentIdentityMatches(row,payment,config)
    || row.payment_id!==payment.id || row.state!=='pending' || row.report_id!==null || row.user_id!==null || row.review_reason!==null
    || row.wallet_review_reason!==null || row.refund_requested_at!==null || !guestPaymentIsDefinitelyFailed(payment)
    || !guestPaymentHasNoCollectedFunds(payment) || !Array.isArray(payment.holds) || payment.holds.length
    || payment.dispute_alerted_at!==null || /dispute|resolution/.test(payment.substatus)
    || payment.refunded_at!==null || payment.auto_refunded!==false
    || !Object.prototype.hasOwnProperty.call(payment,'refunded_amount') || !guestPaymentQuoteMatches(row,payment)) return false
  try { return money(payment.refunded_amount,true)===0 } catch { return false }
}
/** Revoke only this checkout's untouched difference, never unrelated wallet funds.
 * Any outgoing use since the credit is conservatively reviewed because wallet money is fungible.
 * Caller holds an IMMEDIATE transaction so a new hold cannot race the proof and reversal.
 */
function reverseWalletDifference(row: GuestCheckout): boolean {
  if (!row.wallet_credit_cents) return true
  if (!row.customer_user_id) throw new Error('Small card order is missing its customer.')
  const grant=db().prepare("SELECT id,user_id,amount_cents FROM credit_ledger WHERE ref_type='guest_card_difference' AND ref_id=? AND type='topup'").get(row.reference) as {id:number;user_id:number;amount_cents:number}|undefined
  if (!grant || hasCreditTransition('guest_card_difference_refund',row.reference,'adjustment')) return true
  if (grant.user_id!==row.customer_user_id || grant.amount_cents!==row.wallet_credit_cents) throw new Error('Wallet difference identity mismatch.')
  if (db().prepare("SELECT 1 FROM credit_ledger WHERE user_id=? AND id>? AND amount_cents<0 LIMIT 1").get(grant.user_id,grant.id)
    || getBalance(grant.user_id).availableCents<grant.amount_cents) return false
  credit(grant.user_id,-grant.amount_cents,'adjustment','guest_card_difference_refund',row.reference)
  return true
}
/** Only called with a payment retrieved from Whop by the signed webhook worker or reconciliation. */
export function settleGuestPayment(payment: Whop.Payment): string {
  const config=whopConfiguration()
  if (!config || payment.account_id!==config.accountId) throw new Error('Wrong payment account.')
  const ref=payment.metadata?.guest_reference
  if (typeof ref!=='string' || !/^[a-f0-9]{32}$/.test(ref)) return 'unmatched'
  return db().transaction(()=>{
    const row=getGuestCheckout(ref)
    if (!row) return 'unmatched'
    if (row.payment_method !== 'card') throw new Error('Guest payment method mismatch.')
    if (!row.checkout_id) throw new Error('Checkout is still being saved.')
    if (!guestPaymentIdentityMatches(row,payment,config)) throw new Error('Guest payment identity mismatch.')
    if (!/^pay_[A-Za-z0-9]+$/.test(payment.id)) throw new Error('Invalid payment ID.')
    const updated=Date.parse(payment.updated_at)
    if (!Number.isFinite(updated)) throw new Error('Invalid payment timestamp.')
    if (row.payment_id===payment.id && row.processor_updated_at && updated<Date.parse(row.processor_updated_at)) return 'stale'
    if (!guestPaymentIsSettled(payment)) return 'pending'
    if (row.payment_id && row.payment_id!==payment.id) {
      db().prepare("UPDATE guest_checkouts SET review_reason='multiple_payments',wallet_review_reason=CASE WHEN wallet_credit_cents>0 THEN 'multiple_payments' ELSE wallet_review_reason END WHERE reference=?").run(ref)
      return 'review'
    }
    const {total,tax,refunded}=guestPaymentAmounts(row,payment)
    const disputed=(/dispute|resolution/.test(payment.substatus) || !!payment.dispute_alerted_at)
      && !['dispute_won','dispute_warning_closed','resolution_won'].includes(payment.substatus)
    const fullyRefunded=refunded===total || ['refunded','auto_refunded'].includes(payment.substatus)
    let state=row.state, review=row.review_reason
    let walletReview=row.wallet_review_reason
    if (fullyRefunded) {
      state='refunded'
      if (!reverseWalletDifference(row)) walletReview='refunded_credit_used'
      else walletReview=null
      // Isolated guest ledger: never debit money reserved by an in-flight provider request.
      if (row.user_id && !hasCreditTransition('guest_refund',ref,'adjustment')) {
        const available=getBalance(row.user_id).availableCents
        if (available>0) credit(row.user_id,-available,'adjustment','guest_refund',ref)
      }
    } else if (disputed || refunded>0) {
      review=disputed?'dispute':'partial_refund'
      if (row.wallet_credit_cents > 0) walletReview=review
    }
    else if (payment.status==='paid' && ['succeeded','dispute_won','dispute_warning_closed','resolution_won'].includes(payment.substatus) && row.state==='pending') state='paid'
    if (state==='paid' && !review && row.wallet_credit_cents > 0) {
      if (!row.customer_user_id) throw new Error('Small card order is missing its customer.')
      credit(row.customer_user_id,row.wallet_credit_cents,'topup','guest_card_difference',ref)
    }
    db().prepare(`UPDATE guest_checkouts SET tax_cents=?,payment_id=?,state=?,review_reason=?,wallet_review_reason=?,processor_updated_at=?,
      paid_at=COALESCE(paid_at,?),checked_at=datetime('now') WHERE reference=?`).run(tax,payment.id,state,review,walletReview,payment.updated_at,payment.paid_at,ref)
    return review ? 'review' : state
  }).immediate()
}
function guestReport(row: GuestCheckout) { return row.user_id && row.report_id ? getPaidReport(row.user_id,row.report_id) : undefined }
export function guestResult(row: GuestCheckout) {
  const report=guestReport(row)
  const received=row.payment_method==='crypto' && row.crypto_invoice_reference && row.user_id
    ? db().prepare("SELECT credit_amount_cents FROM invoices WHERE reference=? AND user_id=? AND status='success'").get(row.crypto_invoice_reference,row.user_id) as {credit_amount_cents:number}|undefined : undefined
  const progress=row.report_id && row.user_id ? db().prepare('SELECT provider_order_id FROM paid_report_orders WHERE id=? AND user_id=?').get(row.report_id,row.user_id) as {provider_order_id:string|null}|undefined : undefined
  return { reference:row.reference, totalCents:guestCheckoutTotal(row), taxInclusive:row.card_order_price_cents!==null, checkoutUrl:row.state==='pending' && !row.review_reason ? row.checkout_url : null, paymentMethod:row.payment_method, walletCreditCents:row.wallet_credit_cents,
    walletCreditApplied:row.wallet_credit_cents>0 && hasCreditTransition('guest_card_difference',row.reference,'topup') && !hasCreditTransition('guest_card_difference_refund',row.reference,'adjustment'),
    walletCreditReview:Boolean(row.wallet_review_reason), cryptoReceivedCents:received?.credit_amount_cents??null, productName:row.product_name, priceCents:row.price_cents, feeCents:row.fee_cents,
    domain:getPaidReportProduct(row.product_code)?.domain??'imei_check',
    paymentReceived:Boolean(row.paid_at && row.state!=='pending'),
    submitted:Boolean(progress?.provider_order_id || report?.status==='completed'),
    refused:report?.status==='refunded',
    state: row.review_reason ? 'review' : row.state==='refunded' ? 'refunded' : row.state==='refund_pending' ? 'refund_pending' : report?.status==='completed' ? 'completed' : report?.status==='manual_review' ? 'review' : row.state,
    report: row.state!=='refunded' && !row.review_reason && report?.status==='completed' ? report : null }
}
async function dispatchGuest(row: GuestCheckout) {
  const claimed=db().prepare(`UPDATE guest_checkouts SET lease_until=? WHERE reference=? AND lease_until<=?
    AND state='paid' AND review_reason IS NULL`).run(Date.now()+120000,row.reference,Date.now())
  if (!claimed.changes) return
  try {
    row=db().transaction(()=>{
      let current=getGuestCheckout(row.reference)!
      if (!current.user_id) {
        // An isolated accounting owner, not a login account and never linked by an unverified email.
        const id=Number(db().prepare(`INSERT INTO users(username,email,password_hash,status,account_type)
          VALUES (?,?,'!guest-no-login','guest','guest')`).run(`guest-${current.reference}`,`${current.reference}@guest.invalid`).lastInsertRowid)
        db().prepare('UPDATE guest_checkouts SET user_id=? WHERE reference=?').run(id,current.reference)
        credit(id,current.price_cents,'adjustment','guest_payment',current.reference)
        current=getGuestCheckout(current.reference)!
      }
      return current
    }).immediate()
    const result=await createPaidReport(row.user_id!,{productCode:row.product_code,imei:decryptPaidReportImei(row.imei_encrypted)??'',
      idempotencyKey:`guest-${row.reference}`,expectedPriceCents:row.price_cents},'guest')
    db().prepare("UPDATE guest_checkouts SET report_id=?,state='processing' WHERE reference=? AND state='paid'").run(result.order.id,row.reference)
  } catch(error) {
    // A definite pre-submit rejection can be refunded; uncertain submissions remain reserved for review.
    if (error instanceof PaidReportError && ['product_unknown','product_inactive','provider_not_ready','imei_invalid','imei_missing'].includes(error.code)) {
      db().prepare("UPDATE guest_checkouts SET state='refund_pending' WHERE reference=? AND state='paid'").run(row.reference)
    } else db().prepare("UPDATE guest_checkouts SET review_reason='dispatch_review' WHERE reference=?").run(row.reference)
  } finally { db().prepare('UPDATE guest_checkouts SET lease_until=0 WHERE reference=?').run(row.reference) }
}
function escape(value:string) { return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)) }
function resultText(row:GuestCheckout) {
  const result=guestReport(row)
  return result?.providerCode || result?.report?.sections.flatMap(s=>[s.title,...s.items.map(i=>`${i.label}: ${i.value}`)]).join('\n') || 'Your result is available on your private order page.'
}
async function notifyGuest(row:GuestCheckout) {
  const result=guestResult(row), final=['completed','refunded'].includes(result.state)
  const refundNotice=row.state==='refund_pending' && (row.payment_method==='crypto' || row.wallet_review_reason==='refund_credit_used')
  const sentColumn=refundNotice?'refund_notice_sent_at':final?'result_sent_at':'receipt_sent_at'
  if (!row.paid_at || !row.payment_id || !['paid','processing','completed','refund_pending','refunded'].includes(row.state)
    || row[sentColumn] || row.email_next_at>Date.now()) return
  const lock=db().prepare('UPDATE guest_checkouts SET lease_until=? WHERE reference=? AND lease_until<=?').run(Date.now()+30000,row.reference,Date.now())
  if (!lock.changes) return
  try {
    const url=publicOrigin()+guestOrderPath(row.reference)
    let accountPath:string|null=null
    try { if (!row.customer_user_id) accountPath=prepareGuestAccount(row.reference) }
    catch { console.error('[guest-checkout] optional account activation unavailable') }
    const accountUrl=accountPath?publicOrigin()+accountPath:null
    const accountText=accountUrl?`\n\nOptional: save this order to your customer account. Private tracking works without a password. Saving to an existing account may require sign-in. This account link expires 7 days after issue.\n${accountUrl}`:''
    const subject=final ? result.state==='completed' ? 'Your device service result is ready' : 'Your order payment has been refunded' : refundNotice ? 'Your order needs refund assistance' : 'Payment received — track your device service'
    const walletText=row.wallet_credit_cents>0 && result.walletCreditApplied ? `\n\n$${(row.wallet_credit_cents/100).toFixed(2)} was added to your account credit. ${result.walletCreditReview?'A payment review currently restricts spending.':''}` : ''
    const body=`${row.product_name}\nOrder: ${row.reference}\n\n`+(final ? result.state==='completed' ? resultText(row) : (row.payment_method==='crypto' ? 'Your crypto refund has been recorded. Contact support if you need help confirming receipt.' : 'Your payment was refunded to the original payment method. Bank processing time may vary.') : refundNotice ? (row.payment_method==='crypto' ? 'We could not deliver this service. Contact support with your order reference to arrange your crypto refund. Do not send another payment.' : 'We could not deliver this service. Part of this payment was added to your account credit and has been used or reserved. Contact support with your order reference so we can reconcile the remaining credit and arrange your refund. Do not send another payment.') : 'We have received your payment. Keep this private link to check progress without signing in.')+walletText
    await sendTransactionalEmail(row.email,subject,`<pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(body)}</pre><p><a href="${escape(url)}">View your order and result</a></p>${accountUrl?`<p><a href="${escape(accountUrl)}">Save this order to my account</a> (optional, expires 7 days after issue). Private tracking works without a password. Saving to an existing account may require sign-in.</p>`:''}`,`${body}\n\n${url}${accountText}`,{idempotencyKey:`guest/${row.reference}/${refundNotice?row.payment_method==='crypto'?'crypto-refund-assistance':'card-credit-refund-assistance':final?result.state:'receipt'}`})
    db().prepare(`UPDATE guest_checkouts SET ${sentColumn}=datetime('now'),email_attempts=0,email_next_at=0 WHERE reference=?`).run(row.reference)
  } catch {
    db().prepare('UPDATE guest_checkouts SET email_attempts=email_attempts+1,email_next_at=? WHERE reference=?')
      .run(Date.now()+Math.min(3600000,30000*2**Math.min(row.email_attempts,7)),row.reference)
  } finally { db().prepare('UPDATE guest_checkouts SET lease_until=0 WHERE reference=?').run(row.reference) }
}
async function guestAnalytics(row:GuestCheckout) {
  if (row.environment!=='live' || !row.user_id || !row.report_id || row.review_reason || row.state==='refunded' || !ga4Config().enabled) return
  const report=guestReport(row)
  if (report?.status!=='completed' || !hasCreditTransition('paid_imei_report',String(row.report_id),'charge')) return
  const started=markDeliveryStarted()
  const paidAt=row.paid_at ?? row.created_at
  if (toMicros(paidAt)<toMicros(started)) return
  const event={transactionId:`guest-${row.reference}`,eventName:'purchase' as const,kind:'guest',paidAt}
  if (alreadyHandled(event.transactionId,event.eventName)) return
  const context=checkoutContext('guest',row.reference)
  const buyer=row.customer_user_id ? db().prepare('SELECT account_type FROM users WHERE id=?').get(row.customer_user_id) as {account_type:string}|undefined : undefined
  const skip=buyer?.account_type==='admin' || isInternalEmail(row.email) || context?.internal ? 'internal_user'
    : context?.consent==='denied' ? 'consent_denied' : null
  if (skip) { skipEvent(event,skip); db().prepare("UPDATE guest_checkouts SET analytics_state='suppressed' WHERE reference=?").run(row.reference); return }
  if (!claimEvent(event)) return
  db().prepare("UPDATE guest_checkouts SET analytics_state='sending',analytics_attempted_at=datetime('now') WHERE reference=?").run(row.reference)
  // The customer paid the service price (plus any fee); value is that price minus provider cost.
  const paidCents=(row.card_order_price_cents === null ? row.price_cents : guestCheckoutTotal(row)-row.tax_cents)
  const service=serviceForCode(row.product_code,row.product_name)
  const margin=marginCents(service.serviceId,row.card_order_price_cents ?? row.price_cents)
  const who=identity(row.client_id,row.session_id)
  const customerType=customerTypeFor(row.customer_user_id,row.email,paidAt,row.reference)
  const params:Record<string,unknown>={transaction_id:event.transactionId,value:margin.valueCents/100,currency:'USD',engagement_time_msec:100,
    payment_method:row.payment_method==='crypto'?'crypto':'card',customer_type:customerType,
    items:[{item_id:service.serviceId ?? row.product_code,item_name:service.name,item_category:service.category,price:paidCents/100,quantity:1}]}
  if (who.sessionId) params.session_id=who.sessionId
  const reasons=[who.source==='fallback'?'missing_client_id':null,margin.known?null:'margin_unknown'].filter(Boolean).join('; ')||null
  const state=await sendClaimedEvent(event,{client_id:who.clientId,timestamp_micros:toMicros(paidAt),non_personalized_ads:false,events:[{name:'purchase',params}]},
    {valueCents:margin.valueCents,paidCents,clientSource:who.source,customerType,marginKnown:margin.known,reason:reasons})
  db().prepare('UPDATE guest_checkouts SET analytics_state=? WHERE reference=?').run(state,row.reference)
}
/** Run immediately after verified webhooks; durable paid state survives process restarts. */
export async function processPaidGuestCheckouts(limit=5) {
  const config=whopConfiguration()
  const rows=db().prepare(`SELECT * FROM guest_checkouts WHERE state='paid' AND paid_at IS NOT NULL
    AND ((payment_method='card' AND environment=? AND account_id=? AND checkout_id IS NOT NULL)
      OR (payment_method='crypto' AND environment='live' AND crypto_invoice_reference IS NOT NULL))
    AND payment_id IS NOT NULL AND review_reason IS NULL AND lease_until<=? ORDER BY paid_at LIMIT ?`)
    .all(config?.mode??'',config?.accountId??'',Date.now(),Math.max(1,Math.min(limit,10))) as GuestCheckout[]
  const stats={checked:0,errors:0}
  for (const row of rows) {
    try {
      await dispatchGuest(row)
      const current=getGuestCheckout(row.reference)!
      await notifyGuest(current)
      await guestAnalytics(current)
      stats.checked++
    } catch(error) { logPaymentFailure('guest.paid.dispatch',error); stats.errors++ }
  }
  return stats
}

/** Recover recent failed link creation once per request, using its original gateway idempotency key.
 * Unknown outcomes are left for an explicit customer retry, never blind key rotation or payment submission.
 */
export async function recoverGuestCheckoutLinks(limit=3) {
  const config=whopConfiguration(),stats={recovered:0,errors:0}
  if (!config || !guestCheckoutEnabled()) return stats
  const rows=db().prepare(`SELECT * FROM guest_checkouts WHERE payment_method='card' AND state='pending'
    AND environment=? AND account_id=? AND product_id=? AND checkout_id IS NULL AND checkout_url IS NULL
    AND card_order_price_cents IS NOT NULL AND review_reason IS NULL AND last_error IS NULL
    AND created_at>=datetime('now','-24 hours') AND created_at<=datetime('now','-2 minutes')
    AND lease_until<=? AND checkout_link_next_at<=?
    ORDER BY created_at LIMIT ?`).all(config.mode,config.accountId,config.productId,Date.now(),Date.now(),Math.max(1,Math.min(limit,3))) as GuestCheckout[]
  for (const row of rows) {
    const product=getPaidReportProduct(row.product_code)
    if (!product?.providerReady || product.priceCents!==row.price_cents) continue
    const locked=db().prepare(`UPDATE guest_checkouts SET last_error='Checkout link recovery started.',checkout_link_next_at=?
      WHERE reference=? AND state='pending' AND checkout_id IS NULL AND last_error IS NULL AND checkout_link_next_at<=?`)
      .run(Date.now()+60000,row.reference,Date.now())
    if (!locked.changes) continue
    try {
      const imei=decryptPaidReportImei(row.imei_encrypted)
      if (!imei) throw new Error('Saved checkout identifier unavailable.')
      await createGuestCheckout({productCode:row.product_code,imei,email:row.email,requestKey:row.request_key,
        expectedPriceCents:row.price_cents,authenticatedUserId:row.customer_user_id??undefined})
      db().prepare('UPDATE guest_checkouts SET last_error=NULL,checkout_link_next_at=0 WHERE reference=?').run(row.reference)
      await sendGuestCheckoutLink(row.reference)
      stats.recovered++
    } catch(error) {
      logPaymentFailure('guest.checkout.recover',error)
      db().prepare("UPDATE guest_checkouts SET last_error='Checkout link recovery needs an explicit retry; no payment was submitted.' WHERE reference=?").run(row.reference)
      stats.errors++
    }
  }
  return stats
}

/** One requested transactional checkout link, never a campaign or a repeated reminder sequence. */
export async function sendGuestCheckoutLink(reference:string) {
  const row=getGuestCheckout(reference)
  if (!row || row.card_order_price_cents===null || row.state!=='pending' || row.review_reason
    || !row.checkout_url || row.checkout_link_sent_at || row.checkout_link_next_at>Date.now()) return
  const locked=db().prepare(`UPDATE guest_checkouts SET checkout_link_next_at=? WHERE reference=?
    AND state='pending' AND checkout_link_sent_at IS NULL AND checkout_link_next_at<=?`).run(Date.now()+60000,reference,Date.now())
  if (!locked.changes) return
  const url=publicOrigin()+guestOrderPath(reference)
  const total=`$${(guestCheckoutTotal(row)/100).toFixed(2)} USD`
  const body=`iUnlockMobile\n${row.product_name}\nOrder: ${reference}\nTotal: ${total} including our card fee and applicable tax.\n\nYour checkout is saved, but payment has not been confirmed. Continue your secure card payment to start the service. No subscription. If you have already paid, this private link shows your payment status. Do not pay twice. If you did not request this checkout, ignore this email.\n\nContinue secure card payment:\n${url}`
  try {
    await sendTransactionalEmail(row.email,'Your iUnlockMobile order — secure payment link',`<p>${escape(row.product_name)}</p><p>Total: <strong>${escape(total)}</strong>, including our card fee and applicable tax.</p><p>Your checkout is saved, but payment has not been confirmed. Continue your secure card payment to start the service. No subscription.</p><p><a href="${escape(url)}">Continue secure card payment</a></p><p>Already paid? This private link shows your status. Do not pay twice. If you did not request this checkout, ignore this email.</p>`,body,{idempotencyKey:`guest/${reference}/checkout-link`})
    db().prepare("UPDATE guest_checkouts SET checkout_link_sent_at=datetime('now') WHERE reference=?").run(reference)
  } catch { /* Scheduled worker retries; email delivery must not block checkout. */ }
}

/** Existing signed webhook is primary; bounded API reconciliation recovers missed webhooks. */
export async function processGuestCheckouts(limit=5) {
  await processPaidGuestCheckouts(limit)
  await recoverGuestCheckoutLinks(Math.min(limit,3))
  const config=whopConfiguration(),stats={checked:0,errors:0}
  const rows=db().prepare(`SELECT * FROM guest_checkouts WHERE ((payment_method='card' AND environment=? AND account_id=? AND checkout_id IS NOT NULL) OR (payment_method='crypto' AND environment='live' AND crypto_invoice_reference IS NOT NULL))
    AND (checked_at IS NULL OR checked_at<=datetime('now','-1 minute'))
    AND (created_at>=datetime('now','-7 days') OR state IN ('paid','processing','refund_pending')
      OR (payment_method='crypto' AND state='pending' AND review_reason IS NULL
        AND EXISTS(SELECT 1 FROM invoices i WHERE i.reference=guest_checkouts.crypto_invoice_reference AND i.status='success')))
    ORDER BY COALESCE(checked_at,created_at) LIMIT ?`).all(config?.mode??'',config?.accountId??'',Math.max(1,Math.min(limit,10))) as GuestCheckout[]
  const deadline=Date.now()+45000
  for(let row of rows) {
    if(Date.now()>deadline) break
    db().prepare("UPDATE guest_checkouts SET checked_at=datetime('now') WHERE reference=?").run(row.reference)
    let diagnosticStage = 'guest.payment.verify'
    try {
      if(row.payment_method==='crypto') settleGuestCryptoPayment(row.reference)
      else if(config && row.payment_id) {
        const bound=await client(config).payments.retrieve({id:row.payment_id})
        settleGuestPayment(bound)
        row=getGuestCheckout(row.reference)!
        // A failed first attempt remains bound only until a later paid receipt
        // is found and the Whop worker proves the first ID is unpaid.
        if (row.state==='pending' && !row.review_reason && row.payment_id && row.plan_id) {
          diagnosticStage = 'guest.whop.list'
          const page=await client(config).payments.list({plan_id:row.plan_id,first:10})
          diagnosticStage = 'guest.whop.settle'
          for(const listed of page.data) if(listed.id!==row.payment_id && listed.metadata?.guest_reference===row.reference) {
            const payment=await client(config).payments.retrieve({id:listed.id})
            await reconcileGuestPaymentBeforeSettlement(payment)
            settleGuestPayment(payment)
            row=getGuestCheckout(row.reference)!
            if (row.state!=='pending' || row.review_reason) break
          }
        }
      }
      else if(config && row.payment_method==='card' && row.plan_id) {
        diagnosticStage = 'guest.whop.list'
        const page=await client(config).payments.list({plan_id:row.plan_id,first:10})
        diagnosticStage = 'guest.whop.settle'
        for(const listed of page.data) if(listed.metadata?.guest_reference===row.reference) {
          const payment=await client(config).payments.retrieve({id:listed.id})
          await reconcileGuestPaymentBeforeSettlement(payment)
          settleGuestPayment(payment)
        }
      }
      row=getGuestCheckout(row.reference)!
      if(row.state==='pending') await sendGuestCheckoutLink(row.reference)
      diagnosticStage = 'guest.service.dispatch'
      if(row.state==='paid' && !row.review_reason) await dispatchGuest(row)
      row=getGuestCheckout(row.reference)!
      if(guestReport(row)?.status==='refunded' && row.state!=='refunded') {
        db().prepare("UPDATE guest_checkouts SET state='refund_pending' WHERE reference=?").run(row.reference)
        row=getGuestCheckout(row.reference)!
      }
      diagnosticStage = 'guest.refund'
      if(config && row.payment_method==='card' && row.state==='refund_pending' && row.payment_id && !row.review_reason) {
        // Revoke only this checkout's unspent wallet difference before an automatic full refund.
        // If credit has been used, review the allocation instead of refunding twice or taking unrelated funds.
        const canRefund=db().transaction(()=>{
          const current=getGuestCheckout(row.reference)!
          if (reverseWalletDifference(current)) return true
          db().prepare("UPDATE guest_checkouts SET review_reason='wallet_credit_refund_review',wallet_review_reason='refund_credit_used' WHERE reference=?").run(current.reference)
          return false
        }).immediate()
        if (!canRefund) { await notifyGuest(getGuestCheckout(row.reference)!); stats.checked++; continue }
        // Full original-method refund (service and fee); a stable key protects ambiguous retries.
        const refunded=await client(config).payments.refund({id:row.payment_id},{idempotencyKey:`guest-refund-${row.reference}`})
        db().prepare("UPDATE guest_checkouts SET refund_requested_at=COALESCE(refund_requested_at,datetime('now')) WHERE reference=?").run(row.reference)
        settleGuestPayment(refunded)
      }
      row=getGuestCheckout(row.reference)!
      if(guestReport(row)?.status==='completed' && row.state==='processing') {
        db().prepare("UPDATE guest_checkouts SET state='completed' WHERE reference=? AND state='processing'").run(row.reference)
        row=getGuestCheckout(row.reference)!
      }
      diagnosticStage = 'guest.email'
      await notifyGuest(row)
      diagnosticStage = 'guest.analytics'
      await guestAnalytics(row)
      db().prepare('UPDATE guest_checkouts SET last_error=NULL WHERE reference=?').run(row.reference)
      stats.checked++
    } catch (error) {
      logPaymentFailure(diagnosticStage, error)
      db().prepare("UPDATE guest_checkouts SET last_error='Payment or refund verification needs retry; check gateway permissions and identity.' WHERE reference=?").run(row.reference)
      stats.errors++
    }
  }
  return stats
}
