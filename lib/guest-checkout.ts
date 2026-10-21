import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Whop } from '@whop/sdk'
import { db } from './db'
import { cardFeeCents } from './card-fee'
import { parseUsd } from './money'
import { isValidImei, normalizeImei } from './imei'
import { decryptPaidReportImei, encryptPaidReportImei } from './paid-report-imei'
import { createPaidReport, getPaidReport, getPaidReportProduct, PaidReportError } from './paid-reports'
import { credit, getBalance, hasCreditTransition } from './credits'
import { emailDeliveryConfigured, sendTransactionalEmail } from './account-security'
import { client, whopCheckoutEnabled, whopConfiguration, safeWhopCheckoutUrl, WhopPaymentError } from './whop'
import { publicOrigin } from './site'
import { consumeAttempt } from './rate-limit'
import { prepareGuestAccount } from './guest-account'
import { settleGuestCryptoPayment } from './guest-crypto'

// Verified against the live Whop create-checkout API: minimum plan total is USD 1.00.
export const GUEST_CARD_MIN_TOTAL_CENTS = 100

export type GuestCheckout = {
  reference: string; request_key: string; email: string; product_code: string; product_name: string
  imei_encrypted: string; price_cents: number; fee_cents: number; account_id: string; product_id: string
  environment: string; checkout_id: string | null; plan_id: string | null; checkout_url: string | null
  payment_method: 'card' | 'crypto'; crypto_invoice_reference: string | null
  payment_id: string | null; state: string; user_id: number | null; report_id: number | null
  paid_at: string | null; processor_updated_at: string | null; review_reason: string | null; last_error: string | null
  refund_requested_at: string | null; refund_notice_sent_at: string | null; receipt_sent_at: string | null; result_sent_at: string | null
  email_attempts: number; email_next_at: number; client_id: string | null; session_id: string | null
  analytics_state: string; created_at: string
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
  productCode: string; imei: string; email: string; requestKey: string; expectedPriceCents: number
  analytics?: { clientId: string; sessionId: string }
}) {
  const config = whopConfiguration()
  if (!config || !guestCheckoutEnabled()) throw new WhopPaymentError('Guest checkout is temporarily unavailable.', 503)
  const email = input.email.trim().toLowerCase(), imei = normalizeImei(input.imei)
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new WhopPaymentError('Enter a valid delivery email.')
  if (!isValidImei(imei)) throw new WhopPaymentError('Enter a valid 15-digit IMEI.')
  if (!/^[a-f0-9-]{32,64}$/i.test(input.requestKey)) throw new WhopPaymentError('Reload the checkout and try again.')
  const row = db().transaction(() => {
    const existing = db().prepare('SELECT * FROM guest_checkouts WHERE request_key=?').get(input.requestKey) as GuestCheckout | undefined
    if (existing) {
      if (existing.email !== email || existing.product_code !== input.productCode || decryptPaidReportImei(existing.imei_encrypted) !== imei
        || existing.price_cents !== input.expectedPriceCents || existing.payment_method !== 'card' || existing.account_id !== config.accountId || existing.environment !== config.mode) {
        throw new WhopPaymentError('This checkout belongs to a different selection. Reload to start a new order.', 409)
      }
      return existing
    }
    const product = getPaidReportProduct(input.productCode)
    if (!product?.providerReady || product.priceCents <= 0 || product.priceCents > 100000) throw new WhopPaymentError('This service is not available for online payment.', 409)
    if (product.priceCents + cardFeeCents(product.priceCents) < GUEST_CARD_MIN_TOTAL_CENTS) throw new WhopPaymentError('Whop requires a card order total of at least $1.00. This service price has not been increased; use an existing account balance or contact support.', 400)
    if (product.priceCents !== input.expectedPriceCents) throw new WhopPaymentError('The price changed. Reload to review the current price.', 409)
    if (!consumeAttempt('guest-checkout-email', email, 6, 3600)) throw new WhopPaymentError('Too many requests. Please try again later.', 429)
    const reference = randomBytes(16).toString('hex')
    const a = input.analytics
    const validAnalytics = a && /^\d{1,20}\.\d{1,20}$/.test(a.clientId) && /^\d{1,12}$/.test(a.sessionId) && Number(a.sessionId)>0
    db().prepare(`INSERT INTO guest_checkouts (reference,request_key,email,product_code,product_name,imei_encrypted,price_cents,fee_cents,
      account_id,product_id,environment,client_id,session_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      reference,input.requestKey,email,product.code,product.name,encryptPaidReportImei(imei),product.priceCents,cardFeeCents(product.priceCents),
      config.accountId,config.productId,config.mode,validAnalytics ? a.clientId : null, validAnalytics ? a.sessionId : null)
    return getGuestCheckout(reference)!
  }).immediate()
  if (row.state !== 'pending') return { url: guestOrderPath(row.reference) }
  if (row.checkout_url) return { url: row.checkout_url }
  const total = row.price_cents + row.fee_cents
  const checkout = await client(config).checkoutConfigurations.create({
    account_id: config.accountId, mode: 'payment',
    plan: { account_id: config.accountId, product_id: config.productId, currency: 'usd',
      initial_price: total / 100, plan_type: 'one_time', renewal_price: 0,
      title: row.product_name.slice(0,120), description: `One device service order on iunlockmobile.com. Service $${(row.price_cents/100).toFixed(2)} + 5% card fee $${(row.fee_cents/100).toFixed(2)}. No wallet top-up or subscription.`,
      visibility: 'hidden', stock: 1, unlimited_stock: false, force_create_new_plan: true, three_ds_level: 'mandate_challenge',
      payment_method_configuration: { enabled: ['card'], disabled: [], include_platform_defaults: false } },
    metadata: { guest_reference: row.reference, integration: 'iunlockmobile-guest-v1' },
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
  return { url }
}
function money(value: Whop.Money | null | undefined, optional=false) {
  if (!value && optional) return 0
  if (!value || value.currency!=='usd' || value.decimals!==2) throw new Error('Unexpected payment currency.')
  const result=parseUsd(value.amount)
  if (result===null || !Number.isSafeInteger(result) || result<0) throw new Error('Unexpected payment amount.')
  return result
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
    if (row.account_id!==payment.account_id || row.environment!==config.mode || row.product_id!==payment.product_id
      || row.plan_id!==payment.plan_id || row.checkout_id!==payment.checkout_configuration_id
      || payment.metadata?.integration!=='iunlockmobile-guest-v1') throw new Error('Guest payment identity mismatch.')
    if (!/^pay_[A-Za-z0-9]+$/.test(payment.id)) throw new Error('Invalid payment ID.')
    const updated=Date.parse(payment.updated_at)
    if (!Number.isFinite(updated)) throw new Error('Invalid payment timestamp.')
    if (row.payment_id===payment.id && row.processor_updated_at && updated<Date.parse(row.processor_updated_at)) return 'stale'
    if (payment.status!=='paid' && !payment.paid_at && !['refunded','auto_refunded'].includes(payment.substatus)) return 'pending'
    if (row.payment_id && row.payment_id!==payment.id) {
      db().prepare("UPDATE guest_checkouts SET review_reason='multiple_payments' WHERE reference=?").run(ref)
      return 'review'
    }
    const total=money(payment.total), subtotal=money(payment.subtotal), tax=money(payment.tax_amount,true), refunded=money(payment.refunded_amount,true)
    if (payment.currency!=='usd' || subtotal!==row.price_cents+row.fee_cents || total-tax!==subtotal || total<subtotal
      || (tax>0 && payment.tax_behavior!=='exclusive') || refunded>total || payment.payment_method_type!=='card'
      || payment.promo_code_id || !['one_time','subscription_create'].includes(payment.billing_reason??'')) throw new Error('Guest payment amount mismatch.')
    const disputed=(/dispute|resolution/.test(payment.substatus) || !!payment.dispute_alerted_at)
      && !['dispute_won','dispute_warning_closed','resolution_won'].includes(payment.substatus)
    const fullyRefunded=refunded===total || ['refunded','auto_refunded'].includes(payment.substatus)
    let state=row.state, review=row.review_reason
    if (fullyRefunded) {
      state='refunded'
      // Isolated guest ledger: never debit money reserved by an in-flight provider request.
      if (row.user_id && !hasCreditTransition('guest_refund',ref,'adjustment')) {
        const available=getBalance(row.user_id).availableCents
        if (available>0) credit(row.user_id,-available,'adjustment','guest_refund',ref)
      }
    } else if (disputed || refunded>0) { review=disputed?'dispute':'partial_refund' }
    else if (payment.status==='paid' && ['succeeded','dispute_won','dispute_warning_closed','resolution_won'].includes(payment.substatus) && row.state==='pending') state='paid'
    db().prepare(`UPDATE guest_checkouts SET payment_id=?,state=?,review_reason=?,processor_updated_at=?,
      paid_at=COALESCE(paid_at,?),checked_at=datetime('now') WHERE reference=?`).run(payment.id,state,review,payment.updated_at,payment.paid_at,ref)
    return review ? 'review' : state
  }).immediate()
}
function guestReport(row: GuestCheckout) { return row.user_id && row.report_id ? getPaidReport(row.user_id,row.report_id) : undefined }
export function guestResult(row: GuestCheckout) {
  const report=guestReport(row)
  const received=row.payment_method==='crypto' && row.crypto_invoice_reference && row.user_id
    ? db().prepare("SELECT credit_amount_cents FROM invoices WHERE reference=? AND user_id=? AND status='success'").get(row.crypto_invoice_reference,row.user_id) as {credit_amount_cents:number}|undefined : undefined
  const progress=row.report_id && row.user_id ? db().prepare('SELECT provider_order_id FROM paid_report_orders WHERE id=? AND user_id=?').get(row.report_id,row.user_id) as {provider_order_id:string|null}|undefined : undefined
  return { reference:row.reference, paymentMethod:row.payment_method, cryptoReceivedCents:received?.credit_amount_cents??null, productName:row.product_name, priceCents:row.price_cents, feeCents:row.fee_cents,
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
  const refundNotice=row.payment_method==='crypto' && row.state==='refund_pending'
  const sentColumn=refundNotice?'refund_notice_sent_at':final?'result_sent_at':'receipt_sent_at'
  if (!row.paid_at || !row.payment_id || !['paid','processing','completed','refund_pending','refunded'].includes(row.state)
    || row[sentColumn] || row.email_next_at>Date.now()) return
  const lock=db().prepare('UPDATE guest_checkouts SET lease_until=? WHERE reference=? AND lease_until<=?').run(Date.now()+30000,row.reference,Date.now())
  if (!lock.changes) return
  try {
    const url=publicOrigin()+guestOrderPath(row.reference)
    let accountPath:string|null=null
    try { accountPath=prepareGuestAccount(row.reference) }
    catch { console.error('[guest-checkout] optional account activation unavailable') }
    const accountUrl=accountPath?publicOrigin()+accountPath:null
    const accountText=accountUrl?`\n\nOptional: save this order to your customer account. Private tracking works without a password. Saving to an existing account may require sign-in. This account link expires 7 days after issue.\n${accountUrl}`:''
    const subject=final ? result.state==='completed' ? 'Your device service result is ready' : 'Your order payment has been refunded' : row.state==='refund_pending' && row.payment_method==='crypto' ? 'Your crypto order needs refund assistance' : 'Payment received — track your device service'
    const body=`${row.product_name}\nOrder: ${row.reference}\n\n`+(final ? result.state==='completed' ? resultText(row) : (row.payment_method==='crypto' ? 'Your crypto refund has been recorded. Contact support if you need help confirming receipt.' : 'Your payment was refunded to the original payment method. Bank processing time may vary.') : row.state==='refund_pending' && row.payment_method==='crypto' ? 'We could not deliver this service. Contact support with your order reference to arrange your crypto refund. Do not send another payment.' : 'We have received your payment. Keep this private link to check progress without signing in.')
    await sendTransactionalEmail(row.email,subject,`<pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(body)}</pre><p><a href="${escape(url)}">View your order and result</a></p>${accountUrl?`<p><a href="${escape(accountUrl)}">Save this order to my account</a> (optional, expires 7 days after issue). Private tracking works without a password. Saving to an existing account may require sign-in.</p>`:''}`,`${body}\n\n${url}${accountText}`,{idempotencyKey:`guest/${row.reference}/${refundNotice?'crypto-refund-assistance':final?result.state:'receipt'}`})
    db().prepare(`UPDATE guest_checkouts SET ${sentColumn}=datetime('now'),email_attempts=0,email_next_at=0 WHERE reference=?`).run(row.reference)
  } catch {
    db().prepare('UPDATE guest_checkouts SET email_attempts=email_attempts+1,email_next_at=? WHERE reference=?')
      .run(Date.now()+Math.min(3600000,30000*2**Math.min(row.email_attempts,7)),row.reference)
  } finally { db().prepare('UPDATE guest_checkouts SET lease_until=0 WHERE reference=?').run(row.reference) }
}
async function guestAnalytics(row:GuestCheckout) {
  if (row.environment!=='live' || !row.client_id || !row.session_id || !row.user_id || !row.report_id || row.review_reason || row.state==='refunded'
    || row.analytics_state!=='pending' || !process.env.GA4_MEASUREMENT_API_SECRET || process.env.GA4_SERVER_PAYMENTS_ENABLED!=='1'
    || publicOrigin()!=='https://iunlockmobile.com') return
  const report=guestReport(row)
  if (report?.status!=='completed' || !hasCreditTransition('paid_imei_report',String(row.report_id),'charge')) return
  if (!db().prepare("UPDATE guest_checkouts SET analytics_state='sending',analytics_attempted_at=datetime('now') WHERE reference=? AND analytics_state='pending'").run(row.reference).changes) return
  let state='uncertain'
  try {
    const response=await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=G-9WCELVR3V3&api_secret=${encodeURIComponent(process.env.GA4_MEASUREMENT_API_SECRET)}`,{
      method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),body:JSON.stringify({client_id:row.client_id,
        events:[{name:'purchase',params:{transaction_id:`guest-${row.reference}`,value:row.price_cents/100,currency:'USD',session_id:Number(row.session_id),
          items:[{item_id:row.product_code,item_name:row.product_name,price:row.price_cents/100,quantity:1}]}}]})})
    if(response.ok) state='submitted'
  } catch { /* Never replay an ambiguously accepted event. */ }
  db().prepare('UPDATE guest_checkouts SET analytics_state=? WHERE reference=?').run(state,row.reference)
}
/** Existing signed webhook is primary; bounded API reconciliation recovers missed webhooks. */
export async function processGuestCheckouts(limit=5) {
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
    try {
      if(row.payment_method==='crypto') settleGuestCryptoPayment(row.reference)
      else if(config && row.payment_id) settleGuestPayment(await client(config).payments.retrieve({id:row.payment_id}))
      else if(config && row.payment_method==='card' && row.plan_id) {
        const page=await client(config).payments.list({plan_id:row.plan_id,first:10})
        for(const payment of page.data) if(payment.metadata?.guest_reference===row.reference) settleGuestPayment(await client(config).payments.retrieve({id:payment.id}))
      }
      row=getGuestCheckout(row.reference)!
      if(row.state==='paid' && !row.review_reason) await dispatchGuest(row)
      row=getGuestCheckout(row.reference)!
      if(guestReport(row)?.status==='refunded' && row.state!=='refunded') {
        db().prepare("UPDATE guest_checkouts SET state='refund_pending' WHERE reference=?").run(row.reference)
        row=getGuestCheckout(row.reference)!
      }
      if(config && row.payment_method==='card' && row.state==='refund_pending' && row.payment_id && !row.review_reason) {
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
      await notifyGuest(row)
      await guestAnalytics(row)
      db().prepare('UPDATE guest_checkouts SET last_error=NULL WHERE reference=?').run(row.reference)
      stats.checked++
    } catch {
      db().prepare("UPDATE guest_checkouts SET last_error='Payment or refund verification needs retry; check gateway permissions and identity.' WHERE reference=?").run(row.reference)
      stats.errors++
    }
  }
  return stats
}
