import assert from 'node:assert/strict'
import test,{before,after} from 'node:test'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const dir=mkdtempSync(join(tmpdir(),'purchase-server-'))
process.env.IUNLOCKMOBILE_DB=join(dir,'test.db')
process.env.GA4_SERVER_PAYMENTS_ENABLED='1'
process.env.GA4_MEASUREMENT_API_SECRET='test-only'
process.env.IUNLOCKMOBILE_PUBLIC_ORIGIN='https://iunlockmobile.com'
let db:typeof import('../lib/db').db
let a:typeof import('../lib/purchase-analytics')
let conversion:typeof import('../lib/purchase-conversion').purchaseConversion
let ga4:typeof import('../lib/ga4')
const originalFetch=globalThis.fetch
const sent:Array<{client_id:string;events:Array<{params:Record<string,unknown>}>}>=[]
let seq=0
before(async()=>{({db}=await import('../lib/db'));a=await import('../lib/purchase-analytics');({purchaseConversion:conversion}=await import('../lib/purchase-conversion'));ga4=await import('../lib/ga4')
 globalThis.fetch=async(_u,init)=>{sent.push(JSON.parse(String(init?.body)));return new Response(null,{status:204})}
})
after(()=>{globalThis.fetch=originalFetch;rmSync(dir,{recursive:true,force:true})})
function fixture({admin=false,consent=true,charge=true,status='delivered',price=150}={}) {
 const key='request-'+(++seq)
 const u=Number(db().prepare("INSERT INTO users(username,email,password_hash,account_type) VALUES(?,?,?,?)").run(key,key+'@example.test','unused',admin?'admin':'customer').lastInsertRowid)
 a.savePurchaseAnalytics(u,'order',key,{clientId:'12345.67890',sessionId:String(Math.floor(Date.now()/1000))},consent)
 if(!consent)ga4.recordCheckoutContext('order',key,u,'denied',null)
 const id=Number(db().prepare("INSERT INTO orders(user_id,kind,imei,delivery_email,status,delivery,price_cents,eta_hours,idempotency_key) VALUES(?,'carrier_unlock','test-only','test@example.test',?,'remote',?,1,?)").run(u,status,price,key).lastInsertRowid)
 if(charge)db().prepare("INSERT INTO credit_ledger(user_id,amount_cents,type,ref_type,ref_id,balance_after_cents) VALUES(?,?,'charge','order',?,0)").run(u,-price,String(id))
 return {u,id,key,price}
}
test('server sends charged delivered purchases without opening result page, excludes free/admin/failed/holds',async()=>{
 fixture({admin:true});fixture({consent:false});fixture({charge:false});fixture({status:'processing'});fixture({status:'unavailable'});fixture({price:0})
 const row=fixture()
 assert.equal(conversion(row.u,'order',row.id,row.price)?.ga4ServerManaged,true)
 const start=sent.length
 const result=await a.deliverPurchaseAnalytics()
 assert.equal(result.submitted,1);assert.equal(result.skipped,2)
 assert.equal(sent.length-start,1)
 assert.equal(sent.at(-1)!.events[0].params.transaction_id,'unlock-'+row.id)
 // No provider service recorded: value falls back to the charged price and the event says so.
 assert.equal(sent.at(-1)!.events[0].params.value,1.5)
 assert.equal(sent.at(-1)!.events[0].params.payment_method,'credit')
 assert.equal(sent.at(-1)!.events[0].params.customer_type,'new')
 assert.equal((db().prepare("SELECT reason FROM ga4_events_sent WHERE transaction_id=?").get('unlock-'+row.id) as {reason:string}).reason,'margin_unknown')
 assert.equal(sent.at(-1)!.events[0].params.currency,'USD')
 assert.equal(JSON.stringify(sent).includes('test@example.test'),false)
 assert.equal((await a.deliverPurchaseAnalytics()).submitted,0)
})
test('new session cannot attach to existing order or override original context',()=>{
 const row=fixture({consent:false})
 a.savePurchaseAnalytics(row.u,'order',row.key,{clientId:'1.2',sessionId:'123'},true)
 assert.equal(db().prepare('SELECT 1 FROM purchase_analytics WHERE user_id=?').get(row.u),undefined)
})
test('withdrawal clears IDs, suppresses delivery and prevents browser fallback',async()=>{
 const row=fixture();a.revokePurchaseAnalytics(row.u)
 assert.equal(conversion(row.u,'order',row.id,row.price)?.ga4ServerManaged,true)
 assert.equal((await a.deliverPurchaseAnalytics()).submitted,0)
 assert.deepEqual(db().prepare('SELECT client_id,state FROM purchase_analytics WHERE user_id=?').get(row.u),{client_id:'',state:'suppressed'})
 assert.equal((db().prepare("SELECT reason FROM ga4_events_sent WHERE transaction_id=?").get('unlock-'+row.id) as {reason:string}).reason,'consent_denied')
})
test('concurrent workers send once; timeout remains quarantined',async()=>{
 fixture();const start=sent.length
 await Promise.all([a.deliverPurchaseAnalytics(),a.deliverPurchaseAnalytics()])
 assert.equal(sent.length-start,1)
 const row=fixture()
 globalThis.fetch=async()=>{throw new Error('test timeout')}
 assert.equal((await a.deliverPurchaseAnalytics()).uncertain,1)
 assert.equal((await a.deliverPurchaseAnalytics()).uncertain,0)
 assert.equal((db().prepare('SELECT state FROM ga4_events_sent WHERE transaction_id=?').get('unlock-'+row.id) as {state:string}).state,'uncertain')
 globalThis.fetch=async(_u,init)=>{sent.push(JSON.parse(String(init?.body)));return new Response(null,{status:204})}
})
test('refund and missing configuration prevent sending',async()=>{
 const row=fixture()
 db().prepare("INSERT INTO credit_ledger(user_id,amount_cents,type,ref_type,ref_id,balance_after_cents) VALUES(?,?,'refund','order',?,0)").run(row.u,row.price,String(row.id))
 assert.equal((await a.deliverPurchaseAnalytics()).submitted,0)
 delete process.env.GA4_MEASUREMENT_API_SECRET
 assert.equal((await a.deliverPurchaseAnalytics()).disabled,true)
 process.env.GA4_MEASUREMENT_API_SECRET='test-only'
})

test('paid phone reports send value = price minus sheet cost and the charged price in items',async()=>{
 const key='report-'+(++seq)
 const u=Number(db().prepare("INSERT INTO users(username,email,password_hash) VALUES(?,?,'unused')").run(key,key+'@example.test').lastInsertRowid)
 // AT&T USA Clean (718): sheet cost $0.05, retail $4.99 -> margin $4.94.
 a.savePurchaseAnalytics(u,'paid_imei_report',key,{clientId:'12345.67890',sessionId:String(Math.floor(Date.now()/1000))},true)
 db().prepare("INSERT OR IGNORE INTO paid_report_products(code,slug,name,summary,price_cents) VALUES('UNLOCK_718','unlock-718','AT&T Clean','test',499)").run()
 const id=Number(db().prepare("INSERT INTO paid_report_orders(user_id,product_code,product_name,imei_fingerprint,masked_imei,status,price_cents,idempotency_key) VALUES(?,'UNLOCK_718','AT&T Clean','test','test','completed',499,?)").run(u,key).lastInsertRowid)
 db().prepare("INSERT INTO credit_ledger(user_id,amount_cents,type,ref_type,ref_id,balance_after_cents) VALUES(?,-499,'charge','paid_imei_report',?,0)").run(u,String(id))
 assert.equal((await a.deliverPurchaseAnalytics()).submitted,1)
 const event=sent.at(-1)!.events[0]
 assert.equal(event.params.transaction_id,'report-'+id)
 assert.equal(event.params.value,4.94)
 const items=event.params.items as Array<Record<string,unknown>>
 assert.equal(items[0].item_id,'718');assert.equal(items[0].price,4.99);assert.equal(items[0].quantity,1);assert.equal(typeof items[0].item_category,'string')
 assert.ok(Number(event.params.session_id)>0)
 assert.equal(conversion(u,'paid_imei_report',id,499)?.ga4ServerManaged,true)
})
test('second paid purchase of the same customer is returning',async()=>{
 const row=fixture()
 await a.deliverPurchaseAnalytics()
 const id=Number(db().prepare("INSERT INTO orders(user_id,kind,imei,delivery_email,status,delivery,price_cents,eta_hours,idempotency_key) VALUES(?,'carrier_unlock','test-only','test@example.test','delivered','remote',150,1,'second-'||?)").run(row.u,row.u).lastInsertRowid)
 db().prepare("INSERT INTO credit_ledger(user_id,amount_cents,type,ref_type,ref_id,balance_after_cents,created_at) VALUES(?,-150,'charge','order',?,0,datetime('now','+1 second'))").run(row.u,String(id))
 assert.equal((await a.deliverPurchaseAnalytics()).submitted,1)
 assert.equal(sent.at(-1)!.events[0].params.customer_type,'returning')
 // No browser ID was saved for this order: fallback client ID.
 assert.notEqual(sent.at(-1)!.client_id,'12345.67890')
})
