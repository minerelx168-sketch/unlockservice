import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { before, after } from 'node:test'
const dir=mkdtempSync(join(tmpdir(),'payment-analytics-'))
process.env.IUNLOCKMOBILE_DB=join(dir,'test.db')
process.env.GA4_SERVER_PAYMENTS_ENABLED='1'
process.env.GA4_MEASUREMENT_API_SECRET='test-only'
process.env.IUNLOCKMOBILE_PUBLIC_ORIGIN='https://iunlockmobile.com'
let db: typeof import('../lib/db').db
let analytics: typeof import('../lib/payment-analytics')
let credit: typeof import('../lib/credits').credit
const originalFetch=globalThis.fetch
const sent: Record<string, unknown>[]=[]
let sequence=0
before(async()=>{
  ;({db}=await import('../lib/db')); analytics=await import('../lib/payment-analytics'); ({credit}=await import('../lib/credits'))
  globalThis.fetch=async(_url,init)=>{sent.push(JSON.parse(String(init?.body)));return new Response(null,{status:204})}
})
after(()=>{globalThis.fetch=originalFetch;rmSync(dir,{recursive:true,force:true})})
function invoice({admin=false,consent=true,settle=true,ledger=true,live=true}={}) {
 const n=++sequence, ref=n.toString(16).padStart(32,'0')
 const user=Number(db().prepare("INSERT INTO users(username,email,password_hash,account_type) VALUES(?,?,?,?)").run(`test${n}`,`t${n}@example.test`,'unused',admin?'admin':'customer').lastInsertRowid)
 db().prepare("INSERT INTO invoices(reference,user_id,gateway,credit_amount_cents,fee_cents,total_due_cents,provider) VALUES(?,?,'whop_card',100,5,105,'whop')").run(ref,user)
 analytics.savePaymentAnalytics(ref,user,{clientId:'12345.67890',sessionId:String(Math.floor(Date.now()/1000))},consent)
 db().prepare("INSERT INTO whop_topups(invoice_reference,user_id,request_key,account_id,product_id,environment,payment_id,credited) VALUES(?,?,?,'biz_test','prod_test',?,?,?)").run(ref,user,ref,live?'live':'sandbox',`pay_test${n}`,settle?1:0)
 if(settle)db().prepare("UPDATE invoices SET status='success',credited_at=datetime('now') WHERE reference=?").run(ref)
 if(ledger)credit(user,100,'topup','invoice',ref)
 return {ref,user}
}
test('only verified paid live nonadmin deposits with consent and actual ledger credit are sent',async()=>{
 invoice({admin:true});invoice({consent:false});invoice({settle:false});invoice({ledger:false});invoice({live:false})
 const real=invoice()
 const before=sent.length
 const result=await analytics.deliverPaymentAnalytics()
 assert.equal(result.submitted,1);assert.equal(sent.length-before,1)
 const payload=sent.at(-1) as {events:Array<{name:string;params:Record<string,unknown>}>}
 assert.equal(payload.events[0].name,'payment_completed')
 assert.equal(payload.events[0].params.transaction_id,`topup-${real.ref}`)
 assert.equal(payload.events[0].params.value,1);assert.equal(payload.events[0].params.currency,'USD')
 assert.ok(Array.isArray(payload.events[0].params.items))
 assert.equal((await analytics.deliverPaymentAnalytics()).submitted,0)
})
test('revocation suppresses pending events and clears GA identifiers',async()=>{
 const row=invoice();analytics.revokePaymentAnalytics(row.user)
 assert.equal((await analytics.deliverPaymentAnalytics()).submitted,0)
 assert.deepEqual(db().prepare('SELECT state,client_id FROM payment_analytics WHERE invoice_reference=?').get(row.ref),{state:'suppressed',client_id:''})
})
test('cannot backfill already completed invoices by reopening checkout',async()=>{
 const row=invoice({consent:false})
 analytics.savePaymentAnalytics(row.ref,row.user,{clientId:'1.2',sessionId:'123'},true)
 assert.equal(db().prepare('SELECT 1 FROM payment_analytics WHERE invoice_reference=?').get(row.ref),undefined)
})
test('concurrent workers claim only once; ambiguous requests are not automatically retried',async()=>{
 invoice(); const before=sent.length
 await Promise.all([analytics.deliverPaymentAnalytics(),analytics.deliverPaymentAnalytics()])
 assert.equal(sent.length-before,1)
 const row=invoice();globalThis.fetch=async()=>{throw new Error('network timeout')}
 assert.equal((await analytics.deliverPaymentAnalytics()).uncertain,1)
 assert.equal((await analytics.deliverPaymentAnalytics()).uncertain,0)
 assert.equal((db().prepare('SELECT state FROM payment_analytics WHERE invoice_reference=?').get(row.ref) as {state:string}).state,'uncertain')
 globalThis.fetch=async(_url,init)=>{sent.push(JSON.parse(String(init?.body)));return new Response(null,{status:204})}
})
test('missing server secret never sends',async()=>{
 invoice();delete process.env.GA4_MEASUREMENT_API_SECRET
 assert.equal((await analytics.deliverPaymentAnalytics()).disabled,true)
 process.env.GA4_MEASUREMENT_API_SECRET='test-only'
})
test('verified BSC credits use actual settled amount; refunded and unverified deposits are excluded',async()=>{
 // Suppress the valid invoice intentionally left by the missing-secret test.
 db().prepare("UPDATE payment_analytics SET state='suppressed' WHERE state='pending'").run()
 const makeCrypto=(verified:boolean)=>{
  const row=invoice({settle:false,ledger:false})
  db().prepare("DELETE FROM whop_topups WHERE invoice_reference=?").run(row.ref)
  db().prepare("UPDATE invoices SET gateway='bsc_usdt',status='success',credit_amount_cents=125,credited_at=datetime('now') WHERE reference=?").run(row.ref)
  credit(row.user,125,'topup','invoice',row.ref)
  db().prepare(`INSERT INTO invoice_verifications(invoice_reference,chain_id,token_contract,token_decimals,destination_address,tx_hash,verified_credit_cents,provider_mode,status)
   VALUES(?,56,'test-token',18,'test-destination',?,125,'bnb_rpc',?)`).run(row.ref,`test-hash-${row.ref}`,verified?'verified':'submitted')
  return row
 }
 makeCrypto(false);const accepted=makeCrypto(true);const refunded=makeCrypto(true)
 db().prepare("UPDATE invoices SET status='refunded' WHERE reference=?").run(refunded.ref)
 const before=sent.length
 assert.equal((await analytics.deliverPaymentAnalytics()).submitted,1)
 assert.equal(sent.length-before,1)
 const payload=sent.at(-1) as {timestamp_micros:number;events:Array<{params:Record<string,unknown>}>}
 assert.equal(payload.events[0].params.value,1.25)
 assert.equal(payload.events[0].params.payment_method,'crypto')
 assert.equal(payload.events[0].params.transaction_id,`topup-${accepted.ref}`)
 assert.ok(Number.isSafeInteger(payload.timestamp_micros))
})
