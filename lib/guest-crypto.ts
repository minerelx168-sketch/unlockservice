import { randomBytes } from 'node:crypto'
import { db } from './db'
import { authorizedGuestCheckout, getGuestCheckout, guestCheckoutCoreEnabled, guestOrderPath, guestResult, type GuestCheckout } from './guest-checkout'
import { createGuestOrderInvoice, GATEWAYS, PaymentError, submitPaymentReference } from './payments'
import { getCryptoDeposit } from './crypto-deposit'
import { decryptPaidReportImei, encryptPaidReportImei } from './paid-report-imei'
import { serviceIdentifier, identifierField } from './service-identifier'
import { getPaidReportProduct } from './paid-reports'
import { consumeAttempt } from './rate-limit'
import { WhopPaymentError } from './whop'

export function guestCryptoRoutes() {
  return GATEWAYS.filter(route => route.chainId === 56 && route.chainKind === 'evm' && route.feeBasisPoints === 0)
    .map(route => ({ id:route.id, label:route.asset === 'BSC-USD' ? 'USDT · BNB Smart Chain' : `${route.asset} · BNB Smart Chain`, asset:route.asset === 'BSC-USD' ? 'USDT' : route.asset }))
}
export function guestCryptoEnabled() { return guestCheckoutCoreEnabled() && guestCryptoRoutes().length > 0 }
export function guestCryptoPath(reference:string) { return guestOrderPath(reference).replace('/checkout/result/','/checkout/crypto/') }

export async function createGuestCryptoCheckout(input:{
  productCode:string; imei:string; email:string; requestKey:string; expectedPriceCents:number; routeId:string
  analytics?:{clientId:string;sessionId:string}
}) {
  if (!guestCryptoEnabled()) throw new WhopPaymentError('Crypto checkout is temporarily unavailable.',503)
  const route=guestCryptoRoutes().find(candidate=>candidate.id===input.routeId)
  if (!route) throw new WhopPaymentError('Choose an available token on BNB Smart Chain.')
  const inputType=getPaidReportProduct(input.productCode)?.inputType ?? 'imei'
  const email=input.email.trim().toLowerCase(),imei=serviceIdentifier(input.imei,inputType)
  if (email.length>254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new WhopPaymentError('Enter a valid delivery email.')
  if (!imei) throw new WhopPaymentError(identifierField(inputType).error)
  if (!/^[a-f0-9-]{32,64}$/i.test(input.requestKey)) throw new WhopPaymentError('Reload the checkout and try again.')
  const row=db().transaction(()=>{
    const existing=db().prepare('SELECT * FROM guest_checkouts WHERE request_key=?').get(input.requestKey) as GuestCheckout|undefined
    if (existing) {
      if(existing.payment_method!=='crypto' || existing.product_id!==route.id || existing.email!==email || existing.product_code!==input.productCode
        || existing.price_cents!==input.expectedPriceCents || decryptPaidReportImei(existing.imei_encrypted)!==imei) throw new WhopPaymentError('This checkout belongs to a different selection. Reload to start a new order.',409)
      return existing
    }
    const product=getPaidReportProduct(input.productCode)
    if (!product?.providerReady || !Number.isSafeInteger(product.priceCents) || product.priceCents<1 || product.priceCents>100000) throw new WhopPaymentError('This service is not available for online payment.',409)
    if (product.priceCents!==input.expectedPriceCents) throw new WhopPaymentError('The price changed. Reload to review the current price.',409)
    if (!consumeAttempt('guest-checkout-email',email,6,3600)) throw new WhopPaymentError('Too many requests. Please try again later.',429)
    const reference=randomBytes(16).toString('hex')
    const userId=Number(db().prepare(`INSERT INTO users(username,email,password_hash,status,account_type)
      VALUES (?,?,'!guest-no-login','guest','guest')`).run(`guest-${reference}`,`${reference}@guest.invalid`).lastInsertRowid)
    let invoice
    try { invoice=createGuestOrderInvoice(userId,route.id,product.priceCents) }
    catch(error) { if(error instanceof PaymentError) throw new WhopPaymentError(error.message,409); throw error }
    const a=input.analytics
    const validAnalytics=a && /^\d{1,20}\.\d{1,20}$/.test(a.clientId) && /^\d{1,12}$/.test(a.sessionId) && Number(a.sessionId)>0
    db().prepare(`INSERT INTO guest_checkouts (reference,request_key,email,product_code,product_name,imei_encrypted,price_cents,fee_cents,
      account_id,product_id,environment,payment_method,crypto_invoice_reference,user_id,client_id,session_id)
      VALUES (?,?,?,?,?,?,?,0,'crypto',?,'live','crypto',?,?,?,?)`).run(reference,input.requestKey,email,product.code,product.name,
      encryptPaidReportImei(imei,product.inputType),product.priceCents,route.id,invoice.reference,userId,validAnalytics?a.clientId:null,validAnalytics?a.sessionId:null)
    return getGuestCheckout(reference)!
  }).immediate()
  return {url:row.state==='pending' ? guestCryptoPath(row.reference) : guestOrderPath(row.reference)}
}

/** Only verified chain evidence and its matching ledger transition can release a provider order. */
export function settleGuestCryptoPayment(reference:string) {
  return db().transaction(()=>{
    const row=getGuestCheckout(reference)
    if (!row || row.payment_method!=='crypto' || !row.crypto_invoice_reference || !row.user_id) return 'unmatched'
    if(row.state!=='pending' || row.review_reason) return row.review_reason?'review':row.state
    const proof=db().prepare(`SELECT i.status AS invoice_status,i.user_id,i.credit_amount_cents,i.fee_cents,i.tax_cents,i.paid_at,i.credited_at,
      i.payment_route_id,i.payment_chain_id,i.payment_chain_kind,i.payment_token_contract,i.payment_destination_address,i.payment_confirmations_required,
      v.status AS verification_status,v.verified_credit_cents,v.tx_hash,v.matched_log_index,v.confirmations,v.chain_id,v.token_contract,v.destination_address
      FROM invoices i LEFT JOIN invoice_verifications v ON v.invoice_reference=i.reference WHERE i.reference=?`).get(row.crypto_invoice_reference) as {
        invoice_status:string;user_id:number;credit_amount_cents:number;fee_cents:number;tax_cents:number;paid_at:string|null;credited_at:string|null;
        payment_route_id:string;payment_chain_id:number;payment_chain_kind:string;payment_token_contract:string;payment_destination_address:string;payment_confirmations_required:number;
        verification_status:string|null;verified_credit_cents:number|null;tx_hash:string|null;matched_log_index:number|null;confirmations:number;chain_id:number;token_contract:string;destination_address:string
      }|undefined
    if(!proof || proof.invoice_status!=='success' || proof.verification_status!=='verified') return 'pending'
    if(proof.user_id!==row.user_id || proof.payment_route_id!==row.product_id || proof.payment_chain_id!==56 || proof.payment_chain_kind!=='evm'
      || proof.chain_id!==56 || proof.token_contract!==proof.payment_token_contract || proof.destination_address!==proof.payment_destination_address
      || proof.fee_cents!==0 || proof.tax_cents!==0 || !proof.paid_at || !proof.credited_at || !proof.tx_hash || !/^0x[a-f0-9]{64}$/i.test(proof.tx_hash)
      || proof.matched_log_index===null || proof.confirmations<proof.payment_confirmations_required || proof.verified_credit_cents!==proof.credit_amount_cents
      || !db().prepare(`SELECT 1 FROM credit_ledger WHERE user_id=? AND ref_type='invoice' AND ref_id=? AND type='topup' AND affects_balance=1 AND amount_cents=?`)
        .get(row.user_id,row.crypto_invoice_reference,proof.credit_amount_cents)) throw new Error('Crypto payment proof mismatch.')
    if(proof.credit_amount_cents<row.price_cents) {
      db().prepare("UPDATE guest_checkouts SET review_reason='crypto_underpayment' WHERE reference=? AND state='pending'").run(reference)
      return 'review'
    }
    db().prepare(`UPDATE guest_checkouts SET state='paid',payment_id=?,paid_at=?,processor_updated_at=?,checked_at=NULL
      WHERE reference=? AND state='pending' AND review_reason IS NULL`).run(`crypto:${row.crypto_invoice_reference}:${proof.tx_hash}`,proof.paid_at,proof.credited_at,reference)
    return 'paid'
  }).immediate()
}

export async function getGuestCryptoStatus(reference:string,key:string) {
  let row=authorizedGuestCheckout(reference,key)
  if(!row || row.payment_method!=='crypto' || !row.crypto_invoice_reference || !row.user_id) return null
  settleGuestCryptoPayment(reference)
  row=getGuestCheckout(reference)!
  return {deposit:await getCryptoDeposit(row.crypto_invoice_reference!,row.user_id!),order:guestResult(row),resultUrl:guestOrderPath(reference)}
}

export function submitGuestCryptoTransaction(reference:string,key:string,transactionId?:string) {
  const row=authorizedGuestCheckout(reference,key)
  if(!row || row.payment_method!=='crypto' || !row.crypto_invoice_reference || !row.user_id) throw new WhopPaymentError('Order not found.',404)
  if(row.state!=='pending' || row.review_reason) return row.crypto_invoice_reference
  if(transactionId?.trim()) {
    try { submitPaymentReference(row.crypto_invoice_reference,row.user_id,transactionId.trim(),'') }
    catch(error) { if(error instanceof PaymentError) throw new WhopPaymentError(error.message); throw error }
  }
  return row.crypto_invoice_reference
}

