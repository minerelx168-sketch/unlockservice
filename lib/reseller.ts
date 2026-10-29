import { createHash, randomBytes } from 'node:crypto'
import { db } from './db'
import { consumeAttempt } from './rate-limit'
import { getBalance } from './credits'
import { getPaidReport, listPaidReportProducts, type PaidReportView } from './paid-reports'
import { resellerPriceCents } from './reseller-pricing'

export class ResellerError extends Error {
  constructor(message: string, readonly status = 400, readonly code = 'invalid_request') { super(message) }
}
export function requireReseller(userId: number) {
  const user = db().prepare("SELECT id FROM users WHERE id=? AND account_type='reseller' AND status='active' AND banned_at IS NULL AND email_verified_at IS NOT NULL").get(userId)
  if (!user) throw new ResellerError('An active, verified reseller account is required. A single verified top-up of $100 or more activates reseller access.',403,'reseller_required')
}
export function listResellerKeys(userId: number) {
  return db().prepare('SELECT id,name,prefix,created_at,last_used_at,revoked_at FROM reseller_api_keys WHERE user_id=? ORDER BY id DESC LIMIT 50').all(userId) as Array<{
    id:number;name:string;prefix:string;created_at:string;last_used_at:string|null;revoked_at:string|null
  }>
}
export function createResellerKey(userId: number, name: string) {
  requireReseller(userId)
  const clean = name.trim()
  if (!clean || clean.length > 60) throw new ResellerError('Use a key name of 1–60 characters.')
  return db().transaction(() => {
    const { count } = db().prepare('SELECT COUNT(*) count FROM reseller_api_keys WHERE user_id=? AND revoked_at IS NULL').get(userId) as {count:number}
    if (count >= 3) throw new ResellerError('Revoke an existing key before creating another (maximum 3 active keys).',409)
    const token = `ium_live_${randomBytes(32).toString('hex')}`
    const hash = createHash('sha256').update(token).digest('hex')
    const id = Number(db().prepare('INSERT INTO reseller_api_keys(user_id,name,key_hash,prefix) VALUES (?,?,?,?)')
      .run(userId,clean,hash,token.slice(0,18)).lastInsertRowid)
    return { id, api_key: token }
  }).immediate()
}
export function revokeResellerKey(userId: number, id: number) {
  requireReseller(userId)
  db().prepare("UPDATE reseller_api_keys SET revoked_at=COALESCE(revoked_at,datetime('now')) WHERE id=? AND user_id=?").run(id,userId)
}
export function authenticateReseller(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  if (!/^Bearer ium_live_[a-f0-9]{64}$/.test(authorization)) throw new ResellerError('Use Authorization: Bearer with your reseller API key.',401,'unauthorized')
  const hash = createHash('sha256').update(authorization.slice(7)).digest('hex')
  const key = db().prepare('SELECT id,user_id FROM reseller_api_keys WHERE key_hash=? AND revoked_at IS NULL').get(hash) as {id:number;user_id:number}|undefined
  if (!key) throw new ResellerError('Invalid or revoked API key.',401,'unauthorized')
  requireReseller(key.user_id)
  // Per account, so creating another key cannot multiply the rate allowance.
  if (!consumeAttempt('reseller-api',String(key.user_id),120,60)) throw new ResellerError('Too many requests. Retry after one minute.',429,'rate_limited')
  db().prepare("UPDATE reseller_api_keys SET last_used_at=datetime('now') WHERE id=? AND (last_used_at IS NULL OR last_used_at<datetime('now','-1 minute'))").run(key.id)
  return key.user_id
}
export function resellerServices() {
  return listPaidReportProducts().filter(p=>p.providerReady).flatMap(p=>{
    const price = resellerPriceCents(p.priceCents,p.providerCostMicros)
    return price === null ? [] : [{ service_code:p.code,name:p.name,category:p.domain,group:p.group,input_type:p.inputType,
      currency:'USD',retail_price:(p.priceCents/100).toFixed(2),reseller_price:(price/100).toFixed(2),price_cents:price,eta_minutes:p.etaMinutes }]
  })
}
export function resellerBalance(userId: number) {
  const balance = getBalance(userId)
  return {currency:'USD',wallet_balance:(balance.availableCents/100).toFixed(2),wallet_balance_cents:balance.availableCents,
    reserved_cents:balance.heldCents,role:'RESELLER' as const}
}
export function resellerOrder(order: PaidReportView) {
  return {id:order.id,service_code:order.productCode,service_name:order.productName,status:order.status,currency:'USD',
    price:(order.priceCents/100).toFixed(2),price_cents:order.priceCents,identifier:order.imei??order.maskedImei,
    result:order.report,raw_result:order.providerCode??null,message:order.message??null,
    created_at:order.createdAt,updated_at:order.updatedAt,completed_at:order.completedAt??null,
    account_url:`/user/reports/${order.id}`}
}
export function resellerOrderForUser(userId:number,id:number) {
  const order = getPaidReport(userId,id)
  if (!order) throw new ResellerError('Order not found.',404,'order_not_found')
  return resellerOrder(order)
}
export function resellerOrderList(userId:number,before=Number.MAX_SAFE_INTEGER) {
  const ids = db().prepare('SELECT id FROM paid_report_orders WHERE user_id=? AND id<? ORDER BY id DESC LIMIT 50').all(userId,before) as {id:number}[]
  return {orders:ids.map(row=>resellerOrderForUser(userId,row.id)),next_before:ids.length===50?ids[49].id:null}
}
export function resellerLedger(userId:number,before=Number.MAX_SAFE_INTEGER) {
  const transactions = db().prepare('SELECT id,type,amount_cents,currency,balance_after_cents,ref_type,ref_id,created_at FROM wallet_transactions WHERE user_id=? AND id<? ORDER BY id DESC LIMIT 50').all(userId,before) as Array<{
    id:number;type:string;amount_cents:number;currency:string;balance_after_cents:number;ref_type:string;ref_id:string;created_at:string
  }>
  return {transactions,next_before:transactions.length===50?transactions[49].id:null}
}
export function resellerResponse(body:unknown,status=200) {
  return Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...(status===429?{'Retry-After':'60'}:{})}})
}
export function resellerError(error:unknown) {
  if(error instanceof ResellerError) return resellerResponse({error:error.message,code:error.code},error.status)
  return resellerResponse({error:'Temporarily unavailable. Retry the same request key; never create a new order key to retry an uncertain response.',code:'temporarily_unavailable'},503)
}
export function pageCursor(request:Request) {
  const raw=new URL(request.url).searchParams.get('before')
  if(raw===null) return Number.MAX_SAFE_INTEGER
  const n=Number(raw)
  if(!/^\d+$/.test(raw)||!Number.isSafeInteger(n)||n<1) throw new ResellerError('Invalid pagination cursor.')
  return n
}

/** Reconcile the append-only available-money projection without exposing accounts. */
export function walletIntegrity() {
  const row=db().prepare(`SELECT COUNT(*) mismatches FROM users u LEFT JOIN
    (SELECT user_id,SUM(amount_cents) balance FROM wallet_transactions GROUP BY user_id) w ON w.user_id=u.id
    WHERE u.credit_cents-u.held_cents != COALESCE(w.balance,0)`).get() as {mismatches:number}
  return row
}
