import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import test,{before,after} from 'node:test'
const dir=mkdtempSync(join(tmpdir(),'reseller-test-'))
Object.assign(process.env,{IUNLOCKMOBILE_DB:join(dir,'test.db'),IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET:'test-only-reseller-encryption-key-32-characters',IUNLOCKMOBILE_PROVIDER_MODE:'enabled',IUNLOCKMOBILE_PROVIDER_NAME:'test',IUNLOCKMOBILE_PROVIDER_URL:'https://provider.example.test/api',IUNLOCKMOBILE_PROVIDER_API_KEY:'test-only',IUNLOCKMOBILE_IMEI_SERVICE_MAP:JSON.stringify({'check:apple_carrier_lite':{id:'444',mode:'sync'}})})
let database:typeof import('../lib/db'),credits:typeof import('../lib/credits'),pricing:typeof import('../lib/reseller-pricing'),reports:typeof import('../lib/paid-reports'),api:typeof import('../lib/reseller'),webhooks:typeof import('../lib/reseller-webhooks')
let calls=0,failure=false,uncertain=false
const originalFetch=globalThis.fetch
before(async()=>{
  database=await import('../lib/db');credits=await import('../lib/credits');pricing=await import('../lib/reseller-pricing');reports=await import('../lib/paid-reports');api=await import('../lib/reseller');webhooks=await import('../lib/reseller-webhooks')
  database.db().prepare("UPDATE paid_report_products SET price_cents=1000,provider_cost_micros=6000000,is_active=1 WHERE code='APPLE_CARRIER_LITE'").run()
  globalThis.fetch=async(input)=>{
    assert.equal(new URL(String(input)).hostname,'provider.example.test');calls++
    if(uncertain) throw new Error('simulated timeout')
    return Response.json(failure?{success:false,response:'Service unavailable',object:{}}:{success:true,response:'Model: iPhone 15\nSIM Lock: Unlocked',object:{Model:'iPhone 15','SIM Lock':'Unlocked'}})
  }
})
after(()=>{globalThis.fetch=originalFetch;database.db().close();rmSync(dir,{recursive:true,force:true})})
function user(type='customer') {
 const name=randomUUID();return Number(database.db().prepare("INSERT INTO users(username,email,password_hash,account_type,email_verified_at) VALUES (?,?,'test-only',?,datetime('now'))").run(name,`${name}@example.test`,type).lastInsertRowid)
}
function deposit(id:number,amount:number) {
 const ref=randomUUID()
 database.db().transaction(()=>{
   database.db().prepare("INSERT INTO invoices(reference,user_id,gateway,credit_amount_cents,total_due_cents,currency) VALUES (?,?,'test',?,?,'USD')").run(ref,id,amount,amount)
   credits.credit(id,amount,'topup','invoice',ref)
   pricing.upgradeResellerAfterTopup(id,amount,ref)
 }).immediate()
 return ref
}
function role(id:number){return (database.db().prepare('SELECT role FROM users WHERE id=?').get(id) as {role:string}).role}
function order(id:number,key=randomUUID()) {return reports.createPaidReport(id,{productCode:'APPLE_CARRIER_LITE',imei:'490154203237518',idempotencyKey:key},'api')}
function effects(id:number){return api.resellerLedger(id).transactions}

test('price halves gross profit in integer cents; cost is never exposed in API catalog',()=>{
 assert.equal(pricing.resellerPriceCents(1000,6000000),800)
 assert.equal(pricing.resellerPriceCents(3,13000),3)
 assert.equal(pricing.resellerPriceCents(100,0),50)
 assert.equal(pricing.resellerPriceCents(100,1000001),null)
 assert.equal(pricing.resellerPriceCents(100,-1),null)
 assert.equal(pricing.resellerPriceCents(NaN,100),null)
 const p=api.resellerServices().find(p=>p.service_code==='APPLE_CARRIER_LITE')!
 assert.equal(p.reseller_price,'8.00');assert.equal(p.retail_price,'10.00')
 assert.equal(JSON.stringify(p).includes('cost'),false)
 assert.deepEqual(database.db().prepare("SELECT retail_price_cents,reseller_price_cents FROM paid_report_products WHERE code='APPLE_CARRIER_LITE'").get(),{retail_price_cents:1000,reseller_price_cents:800})
})
test('one deposit qualifies at $100; repeated smaller deposits, admin grants and unverified claims do not',()=>{
 const id=user();deposit(id,9999);deposit(id,1);assert.equal(role(id),'RETAIL')
 credits.credit(id,10000,'adjustment','test',randomUUID());assert.equal(role(id),'RETAIL')
 assert.equal(pricing.upgradeResellerAfterTopup(id,10000,'missing'),false)
 const ref=deposit(id,10000);assert.equal(role(id),'RESELLER')
 const balance=credits.getBalance(id)
 credits.credit(id,10000,'topup','invoice',ref);pricing.upgradeResellerAfterTopup(id,10000,ref)
 assert.deepEqual(credits.getBalance(id),balance)
 assert.throws(()=>database.db().prepare("UPDATE users SET account_type='customer' WHERE id=?").run(id),/permanent/)
 credits.credit(id,-balance.availableCents,'adjustment','test',randomUUID());assert.equal(role(id),'RESELLER')
 const admin=user('admin');deposit(admin,10000);assert.equal(role(admin),'ADMIN')
 const guest=user('guest');deposit(guest,10000);assert.equal(role(guest),null)
})
test('wallet ledger follows available balance, refunds exactly once and rejects updates/deletes',()=>{
 const id=user();deposit(id,10000)
 credits.hold(id,800,'test','held-1');assert.equal(api.resellerBalance(id).wallet_balance,'92.00')
 credits.refund(id,800,'test','held-1');credits.refund(id,800,'test','held-1')
 assert.equal(credits.getBalance(id).availableCents,10000)
 assert.deepEqual(effects(id).map(e=>e.type),['AUTO_REFUND','ORDER_DEDUCTION','TOPUP'])
 assert.equal(effects(id).reduce((s,e)=>s+e.amount_cents,0),credits.getBalance(id).availableCents)
 assert.throws(()=>database.db().prepare('UPDATE wallet_transactions SET amount_cents=0 WHERE user_id=?').run(id),/append-only/)
 assert.throws(()=>database.db().prepare('DELETE FROM wallet_transactions WHERE user_id=?').run(id),/append-only/)
 assert.throws(()=>database.db().prepare('UPDATE credit_ledger SET amount_cents=0 WHERE user_id=?').run(id),/append-only/)
})
test('API keys are hashed, owner-scoped, revocable, and blocked for paused/unverified retail accounts',()=>{
 const retail=user();assert.throws(()=>api.createResellerKey(retail,'test'),/reseller/)
 const id=user();deposit(id,10000);const other=user();deposit(other,10000)
 const key=api.createResellerKey(id,'store')
 const req=new Request('https://iunlockmobile.com/api/reseller/v1/balance',{headers:{Authorization:`Bearer ${key.api_key}`}})
 assert.equal(api.authenticateReseller(req),id)
 assert.equal(JSON.stringify(database.db().prepare('SELECT * FROM reseller_api_keys WHERE id=?').get(key.id)).includes(key.api_key),false)
 api.revokeResellerKey(other,key.id);assert.equal(api.authenticateReseller(req),id)
 database.db().prepare("UPDATE users SET status='paused' WHERE id=?").run(id);assert.throws(()=>api.authenticateReseller(req),/active/)
 database.db().prepare("UPDATE users SET status='active' WHERE id=?").run(id)
 api.revokeResellerKey(id,key.id);assert.throws(()=>api.authenticateReseller(req),/revoked/)
})
test('API and website use the same reseller price; concurrent replay pays and calls provider once',async()=>{
 const id=user();deposit(id,10000);const key=randomUUID(),before=calls
 const [first,second]=await Promise.all([order(id,key),order(id,key)])
 assert.equal(first.order.id,second.order.id);assert.equal(calls,before+1);assert.equal(first.order.priceCents,800)
 assert.equal(first.order.status,'completed');assert.equal(credits.getBalance(id).availableCents,9200)
 assert.equal(effects(id).filter(e=>e.type==='ORDER_DEDUCTION').length,1)
 assert.equal(reports.listPaidReportProducts(id).find(p=>p.code==='APPLE_CARRIER_LITE')?.priceCents,800)
 assert.equal(reports.listPaidReportProducts().find(p=>p.code==='APPLE_CARRIER_LITE')?.priceCents,1000)
 assert.equal(api.resellerOrderForUser(id,first.order.id).raw_result,'Model: iPhone 15\nSIM Lock: Unlocked')
 assert.throws(()=>api.resellerOrderForUser(user(),first.order.id),/not found/)
 await assert.rejects(reports.createPaidReport(id,{productCode:'APPLE_CARRIER_LITE',imei:'356938035643809',idempotencyKey:key},'api'),/different report/)
 const website=await reports.createPaidReport(id,{productCode:'APPLE_CARRIER_LITE',imei:'490154203237518',idempotencyKey:randomUUID()},'website')
 assert.equal(website.order.priceCents,800)
})
test('insufficient funds, invalid IMEI, and stale prices never call provider or debit wallet',async()=>{
 const id=user('reseller'),before=calls
 await assert.rejects(order(id),/Not enough credit/)
 await assert.rejects(reports.createPaidReport(id,{productCode:'APPLE_CARRIER_LITE',imei:'490154203237519',idempotencyKey:randomUUID()},'api'),/valid/)
 await assert.rejects(reports.createPaidReport(id,{productCode:'APPLE_CARRIER_LITE',imei:'490154203237518',idempotencyKey:randomUUID(),expectedPriceCents:1},'api'),/price has changed/)
 assert.equal(calls,before);assert.equal(effects(id).length,0)
})
test('provider refusal refunds once; unknown submission stays reserved without resubmitting',async()=>{
 const id=user();deposit(id,10000);failure=true;const key=randomUUID()
 const failed=await order(id,key);failure=false;assert.equal(failed.order.status,'refunded')
 await order(id,key);assert.equal(credits.getBalance(id).availableCents,10000)
 assert.equal(effects(id).filter(e=>e.type==='AUTO_REFUND').length,1)
 uncertain=true;const uncertainKey=randomUUID(),before=calls
 const pending=await order(id,uncertainKey);uncertain=false
 assert.equal(pending.order.status,'manual_review');assert.equal(credits.getBalance(id).availableCents,9200)
 await order(id,uncertainKey);assert.equal(calls,before+1)
})
test('webhook destinations reject private/metadata ranges, URL credentials, non-TLS, redirects targets and IPv6',()=>{
 for(const ip of ['127.0.0.1','10.1.2.3','169.254.169.254','172.16.2.3','192.168.1.2','100.64.1.2','198.18.1.1','::1','::ffff:127.0.0.1','0.0.0.0','224.0.0.1']) assert.equal(webhooks.publicWebhookAddress(ip),false,ip)
 assert.equal(webhooks.publicWebhookAddress('8.8.8.8'),true)
 for(const url of ['http://shop.com/hook','https://localhost/hook','https://127.0.0.1','https://a:b@shop.com/hook','https://shop.com:8443','https://metadata.google.internal/']) assert.throws(()=>webhooks.webhookUrl(url))
 assert.equal(webhooks.webhookUrl('https://shop.com/hook').href,'https://shop.com/hook')
})
test('completed results create one durable event; failures retry and successful acknowledgement stops repeats',async()=>{
 const id=user();deposit(id,10000)
 // Setup uses actual encryption/configuration; only DNS is mocked to avoid external lookups.
 const dns=await import('node:dns/promises')
 const original=dns.default.lookup
 dns.default.lookup=(async()=>[{address:'8.8.8.8',family:4}]) as unknown as typeof original
 let settings:{signing_secret:string}
 try {settings=await webhooks.saveResellerWebhook(id,'https://shop.com/hook')}finally{dns.default.lookup=original}
 const saved=database.db().prepare('SELECT secret_encrypted FROM reseller_webhooks WHERE user_id=?').get(id) as {secret_encrypted:string}
 assert.equal(saved.secret_encrypted.includes(settings.signing_secret),false)
 const result=await order(id)
 assert.equal(webhooks.webhookDeliveries(id).length,1)
 let sent=0
 await webhooks.deliverResellerWebhooks(5,async()=>{sent++;throw new Error('offline')})
 assert.equal(sent,1);assert.equal(webhooks.webhookDeliveries(id)[0].sent_at,null)
 database.db().prepare('UPDATE reseller_webhook_events SET next_at=0 WHERE user_id=?').run(id)
 const delivered=await webhooks.deliverResellerWebhooks(5,async(_url,body,headers)=>{
   sent++;assert.equal(JSON.parse(body).data.id,result.order.id)
   assert.equal(headers['X-IUnlockMobile-Signature'],`sha256=${webhooks.webhookSignature(settings.signing_secret,headers['X-IUnlockMobile-Event-Id'],headers['X-IUnlockMobile-Timestamp'],body)}`)
 })
 assert.equal(delivered.sent,1);assert.ok(webhooks.webhookDeliveries(id)[0].sent_at)
 await webhooks.deliverResellerWebhooks(5,async()=>{sent++});assert.equal(sent,2)
})
