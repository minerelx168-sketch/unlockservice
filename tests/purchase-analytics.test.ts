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
const originalFetch=globalThis.fetch
const sent:Array<{events:Array<{params:Record<string,unknown>}>}>=[]
let seq=0
before(async()=>{({db}=await import('../lib/db'));a=await import('../lib/purchase-analytics');({purchaseConversion:conversion}=await import('../lib/purchase-conversion'))
 globalThis.fetch=async(_u,init)=>{sent.push(JSON.parse(String(init?.body)));return new Response(null,{status:204})}
})
after(()=>{globalThis.fetch=originalFetch;rmSync(dir,{recursive:true,force:true})})
function fixture({admin=false,consent=true,charge=true,status='delivered',price=150}={}) {
 const key='request-'+(++seq)
 const u=Number(db().prepare("INSERT INTO users(username,email,password_hash,account_type) VALUES(?,?,?,?)").run(key,key+'@example.test','unused',admin?'admin':'customer').lastInsertRowid)
 a.savePurchaseAnalytics(u,'order',key,{clientId:'12345.67890',sessionId:String(Math.floor(Date.now()/1000))},consent)
 const id=Number(db().prepare("INSERT INTO orders(user_id,kind,imei,delivery_email,status,delivery,price_cents,eta_hours,idempotency_key) VALUES(?,'carrier_unlock','test-only','test@example.test',?,'remote',?,1,?)").run(u,status,price,key).lastInsertRowid)
 if(charge)db().prepare("INSERT INTO credit_ledger(user_id,amount_cents,type,ref_type,ref_id,balance_after_cents) VALUES(?,?,'charge','order',?,0)").run(u,-price,String(id))
 return {u,id,key,price}
}
test('server sends charged delivered purchases without opening result page, excludes free/admin/failed/holds',async()=>{
 fixture({admin:true});fixture({consent:false});fixture({charge:false});fixture({status:'processing'});fixture({status:'unavailable'});fixture({price:0})
 const row=fixture()
 assert.equal(conversion(row.u,'order',row.id,row.price)?.ga4ServerManaged,true)
 const start=sent.length
 assert.equal((await a.deliverPurchaseAnalytics()).submitted,1)
 assert.equal(sent.length-start,1)
 assert.equal(sent.at(-1)!.events[0].params.transaction_id,'unlock-'+row.id)
 assert.equal(sent.at(-1)!.events[0].params.value,1.5)
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
})
test('concurrent workers send once; timeout remains quarantined',async()=>{
 fixture();const start=sent.length
 await Promise.all([a.deliverPurchaseAnalytics(),a.deliverPurchaseAnalytics()])
 assert.equal(sent.length-start,1)
 const row=fixture()
 globalThis.fetch=async()=>{throw new Error('test timeout')}
 assert.equal((await a.deliverPurchaseAnalytics()).uncertain,1)
 assert.equal((await a.deliverPurchaseAnalytics()).uncertain,0)
 assert.equal((db().prepare('SELECT state FROM purchase_analytics WHERE user_id=?').get(row.u) as {state:string}).state,'uncertain')
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

test('paid phone reports use the actual charged price and server delivery',async()=>{
 const key='report-'+(++seq)
 const u=Number(db().prepare("INSERT INTO users(username,email,password_hash) VALUES(?,?,'unused')").run(key,key+'@example.test').lastInsertRowid)
 db().prepare("INSERT INTO paid_report_products(code,slug,name,summary,price_cents) VALUES('TEST_REPORT','test-report','Test report','test',225)").run()
 a.savePurchaseAnalytics(u,'paid_imei_report',key,{clientId:'12345.67890',sessionId:String(Math.floor(Date.now()/1000))},true)
 const id=Number(db().prepare("INSERT INTO paid_report_orders(user_id,product_code,product_name,imei_fingerprint,masked_imei,status,price_cents,idempotency_key) VALUES(?,'TEST_REPORT','Test report','test','test','completed',225,?)").run(u,key).lastInsertRowid)
 db().prepare("INSERT INTO credit_ledger(user_id,amount_cents,type,ref_type,ref_id,balance_after_cents) VALUES(?,-225,'charge','paid_imei_report',?,0)").run(u,String(id))
 assert.equal((await a.deliverPurchaseAnalytics()).submitted,1)
 assert.equal(sent.at(-1)!.events[0].params.transaction_id,'report-'+id)
 assert.deepEqual(sent.at(-1)!.events[0].params.items,[{item_id:'TEST_REPORT',item_name:'Test report',price:2.25,quantity:1}])
 assert.equal(conversion(u,'paid_imei_report',id,225)?.ga4ServerManaged,true)
})
