import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test,{before,after} from 'node:test'
import type { Whop } from '@whop/sdk'
const dir=mkdtempSync(join(tmpdir(),'guest-checkout-'))
Object.assign(process.env,{IUNLOCKMOBILE_DB:join(dir,'test.db'),IUNLOCKMOBILE_WHOP_ENABLED:'1',IUNLOCKMOBILE_GUEST_CHECKOUT_ENABLED:'1',WHOP_MODE:'live',WHOP_ACCOUNT_ID:'biz_test',WHOP_PRODUCT_ID:'prod_test',WHOP_API_KEY:'test-only',WHOP_WEBHOOK_SECRET:'test-only',RESEND_API_KEY:'test-only',IUNLOCKMOBILE_EMAIL_FROM:'support@example.test',IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET:'test-secret-for-guest-checkout-32-characters',IUNLOCKMOBILE_PROVIDER_MODE:'enabled',IUNLOCKMOBILE_PROVIDER_NAME:'test',IUNLOCKMOBILE_PROVIDER_URL:'https://provider.example.test/api',IUNLOCKMOBILE_PROVIDER_API_KEY:'test-only',IUNLOCKMOBILE_IMEI_SERVICE_MAP:JSON.stringify({'check:apple_carrier_lite':{id:'444',mode:'sync'}}),IUNLOCKMOBILE_PUBLIC_ORIGIN:'https://iunlockmobile.com',GA4_SERVER_PAYMENTS_ENABLED:'1',GA4_MEASUREMENT_API_SECRET:'test-only'})
let guest:typeof import('../lib/guest-checkout'),db:typeof import('../lib/db'),credits:typeof import('../lib/credits')
const originalFetch=globalThis.fetch,payments=new Map<string,Whop.Payment>()
const emails:Record<string,unknown>[]=[],events:Record<string,unknown>[]=[],refunds:string[]=[]
let providerCalls=0,checkoutCalls=0,emailFailure=false,providerFailure=false,providerUncertain=false
before(async()=>{
  guest=await import('../lib/guest-checkout');db=await import('../lib/db');credits=await import('../lib/credits')
  db.db().prepare("UPDATE paid_report_products SET price_cents=1000,is_active=1 WHERE code='APPLE_CARRIER_LITE'").run()
  globalThis.fetch=async(input,init)=>{
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url)
    if(url.hostname==='api.whop.com') {
      if(url.pathname.endsWith('/checkout_configurations')) {
        checkoutCalls++
        const body=JSON.parse(String(init?.body)),ref=body.metadata.guest_reference
        const quote=db.db().prepare('SELECT price_cents+wallet_credit_cents+fee_cents AS total FROM guest_checkouts WHERE reference=?').get(ref) as {total:number}
        assert.equal(body.plan.initial_price,quote.total/100);assert.equal(body.plan.plan_type,'one_time')
        assert.equal(JSON.stringify(body).includes('490154203237518'),false)
        return Response.json({id:`ch_${ref}`,account_id:'biz_test',purchase_url:`https://whop.com/checkout/ch_${ref}`,plan:{...body.plan,id:`plan_${ref}`}})
      }
      if(url.pathname.endsWith('/refund')) {
        const id=url.pathname.split('/').at(-2)!,p=payments.get(id)!
        refunds.push(id);const result={...p,substatus:'refunded',refunded_amount:p.total,updated_at:new Date().toISOString()} as Whop.Payment
        payments.set(id,result);return Response.json(result)
      }
      if(url.pathname.endsWith('/payments')) return Response.json({data:[],page_info:{has_next_page:false,has_previous_page:false}})
      const p=payments.get(url.pathname.split('/').at(-1)!)
      return p?Response.json(p):Response.json({error:'not found'},{status:404})
    }
    if(url.hostname==='provider.example.test') {
      providerCalls++
      if(providerUncertain) throw new Error('Simulated timeout')
      return Response.json(providerFailure?{success:false,response:'Service unavailable',object:{}}:{success:true,response:'Model: iPhone 15\nSIM Lock: Unlocked',object:{Model:'iPhone 15','SIM Lock':'Unlocked'}})
    }
    if(url.hostname==='api.resend.com') {if(emailFailure)return Response.json({error:'test'},{status:503});emails.push(JSON.parse(String(init?.body)));return Response.json({id:'email_test'})}
    if(url.hostname==='www.google-analytics.com') {events.push(JSON.parse(String(init?.body)));return new Response(null,{status:204})}
    throw new Error(`Unexpected network destination ${url.hostname}`)
  }
})
after(()=>{globalThis.fetch=originalFetch;db.db().close();rmSync(dir,{recursive:true,force:true})})
async function checkout(extra:Record<string,unknown>={}) {
  const input={productCode:'APPLE_CARRIER_LITE',imei:'490154203237518',email:`${randomUUID()}@example.test`,requestKey:randomUUID(),expectedPriceCents:1000,...extra}
  const result=await guest.createGuestCheckout(input)
  const row=db.db().prepare('SELECT * FROM guest_checkouts WHERE request_key=?').get(input.requestKey) as import('../lib/guest-checkout').GuestCheckout
  return {input,result,row}
}
function payment(row:import('../lib/guest-checkout').GuestCheckout,overrides:Record<string,unknown>={}) {
  const money=(amount:string)=>({amount,currency:'usd',decimals:2})
  const p={id:`pay_${row.reference}`,account_id:'biz_test',product_id:'prod_test',plan_id:row.plan_id,checkout_configuration_id:row.checkout_id,
    metadata:{integration:'iunlockmobile-guest-v1',guest_reference:row.reference},status:'paid',substatus:'succeeded',currency:'usd',subtotal:money(((row.price_cents+row.wallet_credit_cents+row.fee_cents)/100).toFixed(2)),total:money(((row.price_cents+row.wallet_credit_cents+row.fee_cents)/100).toFixed(2)),tax_amount:null,refunded_amount:money('0.00'),payment_method_type:'card',billing_reason:'one_time',paid_at:new Date().toISOString(),updated_at:new Date().toISOString(),...overrides} as unknown as Whop.Payment
  payments.set(p.id,p);return p
}
function due(ref:string) {db.db().prepare("UPDATE guest_checkouts SET checked_at=datetime('now','-2 minutes'),email_next_at=0 WHERE reference=?").run(ref)}
async function cycle(ref:string) {due(ref);const stats=await guest.processGuestCheckouts(10);assert.equal(stats.errors,0)}
test('guest checkout accepts no login, quotes exact service + 5%, validates price and request replay',async()=>{
  const {input,row}=await checkout(),calls=checkoutCalls
  await guest.createGuestCheckout(input);assert.equal(checkoutCalls,calls)
  assert.equal(row.user_id,null);assert.equal(row.price_cents,1000);assert.equal(row.fee_cents,50)
  await assert.rejects(guest.createGuestCheckout({...input,email:'different@example.test'}),/different selection/)
  await assert.rejects(checkout({expectedPriceCents:1}),/price changed/)
  await assert.rejects(checkout({imei:'123'}),/IMEI/)
  const key=new URL(guest.guestOrderPath(row.reference),'https://iunlockmobile.com').searchParams.get('key')!
  assert.equal(guest.authorizedGuestCheckout(row.reference,key)?.reference,row.reference)
  assert.equal(guest.authorizedGuestCheckout(row.reference,'0'.repeat(64)),undefined)
  assert.equal(guest.authorizedGuestCheckout('0'.repeat(32),key),undefined)
})
test('only verified full payment dispatches once, sends actual result by email and one purchase, not a topup',async()=>{
  const {row}=await checkout({analytics:{clientId:'123.456',sessionId:'1780000000'}}),before=providerCalls
  await cycle(row.reference);assert.equal(providerCalls,before)
  const p=payment(row)
  assert.throws(()=>guest.settleGuestPayment({...p,total:{amount:'1.00',currency:'usd',decimals:2,display_decimals:2}}),/amount mismatch/)
  assert.throws(()=>guest.settleGuestPayment({...p,account_id:'biz_wrong'}),/account/)
  assert.throws(()=>guest.settleGuestPayment({...p,plan_id:'plan_wrong'}),/identity/)
  guest.settleGuestPayment(p);guest.settleGuestPayment(p)
  due(row.reference);await Promise.all([guest.processGuestCheckouts(10),guest.processGuestCheckouts(10)]);await cycle(row.reference)
  const saved=guest.getGuestCheckout(row.reference)!
  assert.equal(providerCalls,before+1);assert.ok(saved.report_id)
  assert.equal(guest.guestResult(saved).state,'completed')
  assert.equal(credits.getBalance(saved.user_id!).availableCents,0)
  const user=db.db().prepare('SELECT status,password_hash FROM users WHERE id=?').get(saved.user_id) as {status:string;password_hash:string}
  assert.equal(user.status,'guest');assert.equal(user.password_hash,'!guest-no-login')
  assert.equal(db.db().prepare("SELECT 1 FROM credit_ledger WHERE user_id=? AND type='topup'").get(saved.user_id),undefined)
  assert.ok(emails.some(e=>String(e.text).includes('SIM Lock: Unlocked')&&String(e.text).includes(guest.guestOrderPath(row.reference))))
  const sent=events.filter(e=>JSON.stringify(e).includes(`guest-${row.reference}`))
  assert.equal(sent.length,1);assert.equal(JSON.stringify(sent).includes('payment_completed'),false)
  assert.equal(JSON.stringify(sent).includes(row.email),false)
})
test('failed service refunds to original method once, with fee, no leftover spendable credit',async()=>{
  const {row}=await checkout();providerFailure=true
  const p=payment(row);guest.settleGuestPayment(p)
  await cycle(row.reference);providerFailure=false;await cycle(row.reference)
  const saved=guest.getGuestCheckout(row.reference)!
  assert.equal(saved.state,'refunded');assert.equal(credits.getBalance(saved.user_id!).availableCents,0)
  assert.equal(refunds.filter(id=>id===p.id).length,1)
  assert.ok(emails.some(e=>String(e.text).includes(row.reference)&&String(e.text).includes('original payment method')))
})
test('pre-fulfilment refund and disputed/duplicate payments never dispatch',async()=>{
  const before=providerCalls,{row}=await checkout(),p=payment(row,{refunded_amount:{amount:'10.50',currency:'usd',decimals:2},substatus:'refunded'})
  guest.settleGuestPayment(p);await cycle(row.reference);assert.equal(providerCalls,before)
  const second=await checkout(),q=payment(second.row,{substatus:'dispute_opened'})
  guest.settleGuestPayment(q);await cycle(second.row.reference);assert.equal(providerCalls,before)
  const third=await checkout(),r=payment(third.row);guest.settleGuestPayment(r)
  guest.settleGuestPayment({...r,id:`pay_duplicate${third.row.reference}`});await cycle(third.row.reference)
  assert.equal(providerCalls,before);assert.equal(guest.getGuestCheckout(third.row.reference)?.review_reason,'multiple_payments')
})
test('changed service price after payment refunds instead of charging more',async()=>{
  const {row}=await checkout();guest.settleGuestPayment(payment(row))
  db.db().prepare("UPDATE paid_report_products SET price_cents=2000 WHERE code='APPLE_CARRIER_LITE'").run()
  const before=providerCalls;await cycle(row.reference)
  assert.equal(providerCalls,before);assert.equal(guest.getGuestCheckout(row.reference)?.state,'refunded')
  db.db().prepare("UPDATE paid_report_products SET price_cents=1000 WHERE code='APPLE_CARRIER_LITE'").run()
})
test('uncertain provider response is not retried or refunded blindly; failed email retries without a second order',async()=>{
  const {row}=await checkout();providerUncertain=true;emailFailure=true;guest.settleGuestPayment(payment(row))
  const before=providerCalls;await cycle(row.reference);providerUncertain=false;emailFailure=false;await cycle(row.reference)
  assert.equal(providerCalls,before+1);const saved=guest.getGuestCheckout(row.reference)!
  assert.equal(guest.guestResult(saved).state,'review');assert.ok(saved.receipt_sent_at)
  assert.equal(credits.getBalance(saved.user_id!).heldCents,1000)
  assert.equal(refunds.filter(id=>id===saved.payment_id).length,0)
})

function customer(email=`${randomUUID()}@example.test`,extra:Record<string,string|null>={}) {
  const id=Number(db.db().prepare("INSERT INTO users(username,email,password_hash,email_verified_at) VALUES (?,?,?,?)").run(`small-${randomUUID()}`,email,'!test-only',new Date().toISOString()).lastInsertRowid)
  for(const [key,value] of Object.entries(extra)) { assert.ok(['account_type','status','banned_at','email_verified_at'].includes(key));db.db().prepare(`UPDATE users SET ${key}=? WHERE id=?`).run(value,id) }
  return {id,email}
}
async function smallCheckout(extra:Record<string,unknown>={}) {
  const account=customer()
  db.db().prepare("UPDATE paid_report_products SET price_cents=75 WHERE code='APPLE_CARRIER_LITE'").run()
  return {...await checkout({email:account.email,authenticatedUserId:account.id,expectedPriceCents:75,...extra}),account}
}
test('sub-dollar card quote requires a verified active customer and preserves the service price',async()=>{
  db.db().prepare("UPDATE paid_report_products SET price_cents=75 WHERE code='APPLE_CARRIER_LITE'").run()
  const calls=checkoutCalls
  await assert.rejects(checkout({expectedPriceCents:75}),/Create an account/)
  for (const extra of [{account_type:'admin'},{status:'paused'},{banned_at:new Date().toISOString()},{email_verified_at:null}] as Array<Record<string,string|null>>) {
    const account=customer(undefined,extra)
    await assert.rejects(checkout({email:account.email,authenticatedUserId:account.id,expectedPriceCents:75}),/Create an account/)
  }
  assert.equal(checkoutCalls,calls)
  const account=customer()
  await assert.rejects(checkout({email:'other@example.test',authenticatedUserId:account.id,expectedPriceCents:75}),/account email/)
  const {row,input}=await smallCheckout()
  assert.equal(row.price_cents,75);assert.equal(row.wallet_credit_cents,25);assert.equal(row.fee_cents,5)
  assert.equal(row.price_cents+row.wallet_credit_cents+row.fee_cents,105)
  await assert.rejects(guest.createGuestCheckout({...input,authenticatedUserId:account.id}),/different selection/)
  await assert.rejects(guest.createGuestCheckout({...input,authenticatedUserId:undefined}),(error:unknown)=>!!error && typeof error==='object' && 'status' in error && error.status===401)
  assert.equal(credits.getBalance(row.customer_user_id!).availableCents,0)
})
test('verified small card payment grants the difference once then orders only the service amount',async()=>{
  const {row,account}=await smallCheckout(),before=providerCalls
  const p=payment(row)
  assert.throws(()=>guest.settleGuestPayment({...p,subtotal:{amount:'0.80',currency:'usd',decimals:2,display_decimals:2},total:{amount:'0.80',currency:'usd',decimals:2,display_decimals:2}}),/amount mismatch/)
  assert.equal(credits.getBalance(account.id).availableCents,0)
  guest.settleGuestPayment(p);guest.settleGuestPayment(p)
  assert.equal(credits.getBalance(account.id).availableCents,25)
  await cycle(row.reference);await cycle(row.reference)
  const saved=guest.getGuestCheckout(row.reference)!
  assert.equal(providerCalls,before+1);assert.equal(guest.guestResult(saved).state,'completed')
  assert.equal(credits.getBalance(account.id).availableCents,25)
  assert.equal(credits.getBalance(saved.user_id!).availableCents,0)
  assert.notEqual(saved.user_id,account.id)
  assert.equal(guest.guestResult(saved).walletCreditApplied,true)
  assert.equal((db.db().prepare("SELECT COUNT(*) AS n FROM credit_ledger WHERE ref_type='guest_card_difference' AND ref_id=?").get(row.reference) as {n:number}).n,1)
})
test('a refused small order refunds and reverses only its untouched difference',async()=>{
  const {row,account}=await smallCheckout()
  credits.credit(account.id,300,'topup','test-prefund',row.reference)
  providerFailure=true;const p=payment(row);guest.settleGuestPayment(p)
  await cycle(row.reference);providerFailure=false;await cycle(row.reference)
  assert.equal(guest.getGuestCheckout(row.reference)?.state,'refunded')
  assert.equal(credits.getBalance(account.id).availableCents,300)
  assert.equal(guest.guestResult(guest.getGuestCheckout(row.reference)!).walletCreditApplied,false)
  assert.equal(refunds.filter(id=>id===p.id).length,1)
})
test('spent or reserved difference stops automatic refund and blocks new wallet spending for review',async()=>{
  const {row,account}=await smallCheckout()
  credits.credit(account.id,300,'topup','test-prefund',row.reference)
  const p=payment(row);guest.settleGuestPayment(p)
  credits.hold(account.id,10,'test-spend',row.reference)
  credits.charge(account.id,10,'test-spend',row.reference)
  db.db().prepare("UPDATE guest_checkouts SET receipt_sent_at=datetime('now') WHERE reference=?").run(row.reference)
  providerFailure=true;await cycle(row.reference);providerFailure=false
  const saved=guest.getGuestCheckout(row.reference)!
  assert.equal(saved.state,'refund_pending');assert.equal(saved.wallet_review_reason,'refund_credit_used')
  assert.equal(credits.getBalance(account.id).availableCents,315)
  assert.equal(refunds.filter(id=>id===p.id).length,0)
  assert.throws(()=>credits.hold(account.id,1,'test-blocked',row.reference),/payment.*review/)
  assert.ok(emails.some(e=>String(e.text).includes(row.reference)&&String(e.text).includes('reconcile the remaining credit')))
})
test('external refund after wallet use never takes unrelated credit and installs a spend blocker',async()=>{
  const {row,account}=await smallCheckout(),p=payment(row)
  credits.credit(account.id,300,'topup','test-prefund',row.reference)
  guest.settleGuestPayment(p);credits.hold(account.id,10,'test-spend',row.reference);credits.charge(account.id,10,'test-spend',row.reference)
  const refunded={...p,substatus:'refunded',refunded_amount:p.total,updated_at:new Date().toISOString()} as Whop.Payment
  guest.settleGuestPayment(refunded);guest.settleGuestPayment(refunded)
  assert.equal(guest.getGuestCheckout(row.reference)?.state,'refunded')
  assert.equal(guest.getGuestCheckout(row.reference)?.wallet_review_reason,'refunded_credit_used')
  assert.equal(credits.getBalance(account.id).availableCents,315)
  assert.throws(()=>credits.hold(account.id,1,'test-blocked',row.reference),/payment.*review/)
})
test('disputes on small orders block wallet spending without creating duplicate credit',async()=>{
  const {row,account}=await smallCheckout(),p=payment(row)
  guest.settleGuestPayment(p)
  guest.settleGuestPayment(payment(row,{substatus:'dispute_opened',updated_at:new Date().toISOString()}))
  assert.equal(credits.getBalance(account.id).availableCents,25)
  assert.equal(guest.getGuestCheckout(row.reference)?.wallet_review_reason,'dispute')
  assert.throws(()=>credits.hold(account.id,1,'test-blocked',row.reference),/payment.*review/)
})

test('reopening a small pending checkout revalidates account state and payment review',async()=>{
  const {row,account,input}=await smallCheckout()
  db.db().prepare("UPDATE users SET account_type='admin' WHERE id=?").run(account.id)
  await assert.rejects(guest.createGuestCheckout(input),/Sign in to the customer account/)
  db.db().prepare("UPDATE users SET account_type='customer',email=? WHERE id=?").run('changed@example.test',account.id)
  await assert.rejects(guest.createGuestCheckout(input),/Sign in to the customer account/)
  db.db().prepare('UPDATE users SET email=? WHERE id=?').run(account.email,account.id)
  db.db().prepare("UPDATE guest_checkouts SET wallet_review_reason='dispute' WHERE reference=?").run(row.reference)
  await assert.rejects(guest.createGuestCheckout(input),/payment.*review/)
})

