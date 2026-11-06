import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'carrier-eligibility-'))
Object.assign(process.env, { IUNLOCKMOBILE_DB: join(dir, 'test.db'), IUNLOCKMOBILE_PROVIDER_MODE: 'disabled', IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET: 'synthetic-fingerprint-secret-more-than-thirty-two-chars' })
let eligibility: typeof import('../lib/unlock-eligibility')
let db: typeof import('../lib/db').db
let fingerprintImei: typeof import('../lib/imei-privacy').fingerprintImei
let att: string, spire: string, nonUs: string
before(async () => {
  eligibility = await import('../lib/unlock-eligibility')
  ;({ db } = await import('../lib/db'))
  ;({ fingerprintImei } = await import('../lib/imei-privacy'))
  const { PROVIDER_PRODUCTS } = await import('../lib/provider-products')
  att = PROVIDER_PRODUCTS.find(p => p.domain === 'unlock' && p.group === 'USA Networks' && p.name.startsWith('AT&T'))!.productCode
  spire = PROVIDER_PRODUCTS.find(p => p.domain === 'unlock' && p.group === 'USA Networks' && p.name.includes('C Spire'))!.productCode
  nonUs = PROVIDER_PRODUCTS.find(p => p.domain === 'unlock' && p.group !== 'USA Networks')!.productCode
})
function classify(providerCode: string, productCode = att) { return eligibility.classifyUnlockEligibility({ productCode, providerCode }) }
function report(carrier: string, plan: string) {
  return { schemaVersion: 1, checkType: 'APPLE_CARRIER_LITE', source: 'mock', title: 'Carrier', summary: '', nextStep: '', checks: [], sections: [{ title: 'Carrier', items: [{key:'carrier', label:'Carrier', value:carrier},{key:'plan_type', label:'Plan type', value:plan}] }] }
}
const imei = ['35', '1'.repeat(13)].join('')
after(() => rmSync(dir, { recursive: true, force: true }))
test('explicit matching AT&T postpaid and C Spire contract are supported', () => {
  assert.equal(classify('Carrier: AT&T\nPlan: postpaid').status, 'supported')
  assert.equal(classify('Carrier: C Spire\nPlan: contract', spire).status, 'supported')
})
test('prepaid, MVNO and named unsupported carriers block before checkout', () => {
  for (const raw of ['Carrier: AT&T\nPlan: prepaid', 'Carrier: AT&T\nPlan: MVNO', ...['Cricket','Metro','Boost','Straight Talk','Tracfone'].map(x=>`Carrier: ${x}\nPlan: postpaid`)]) {
    const result=classify(raw); assert.equal(result.blocksCheckout,true); assert.equal(result.message,"This carrier isn't supported yet")
  }
})
test('carrier name alone and negative contract fields never prove support', () => {
  for(const raw of ['Carrier: AT&T', 'Carrier: AT&T\nContract: No', 'Carrier: AT&T\nPlan: no contract', 'Carrier: AT&T\nPrepaid: No']) assert.notEqual(classify(raw).status,'supported')
})
test('negative prepaid field does not override explicit postpaid evidence', () => {
  assert.equal(classify('Carrier: AT&T\nPrepaid: No\nPlan: postpaid').status,'supported')
})
test('HTML evidence labels or values and arbitrary JSON cannot create support', () => {
  for(const raw of ['<b>Carrier</b>: AT&T\nPlan: postpaid','Carrier: <b>AT&T</b>\nPlan: postpaid','{"carrier":"AT&T","plan":"postpaid"}']) assert.notEqual(classify(raw).status,'supported')
})
test('wrong supported carrier and conflicting plan evidence block conservatively', () => {
  assert.equal(classify('Carrier: C Spire\nPlan: contract').blocksCheckout,true)
  assert.equal(classify('Carrier: AT&T\nPlan: prepaid\nSubscription: postpaid').blocksCheckout,true)
})
test('non-US unlock and check-only products are outside this carrier policy', () => {
  assert.equal(classify('Carrier: Cricket\nPlan: prepaid',nonUs).status,'not_applicable')
  assert.equal(classify('Carrier: Cricket\nPlan: prepaid','APPLE_CARRIER_LITE').blocksCheckout,false)
})
test('missing anonymous evidence is unknown, never represented as supported', () => {
  const result=eligibility.getUnlockEligibility(undefined,imei,att)
  assert.equal(result.status,'unknown'); assert.equal(result.hasTrustedResult,false)
})
test('trusted cache is owner-bound and safely parses report arrays', () => {
  const c=db();const user=Number(c.prepare("INSERT INTO users(username,email,password_hash,status,account_type) VALUES('carrier-owner','carrier-owner@example.test','!test','active','customer')").run().lastInsertRowid)
  c.prepare("INSERT INTO imei_checks(user_id,check_type,imei_fingerprint,masked_imei,status,result_json) VALUES(?,'APPLE_CARRIER_LITE',?,'synthetic','completed',?)").run(user,fingerprintImei(imei),JSON.stringify([report('AT&T','prepaid')]))
  assert.equal(eligibility.getUnlockEligibility(user,imei,att).status,'unsupported')
  assert.equal(eligibility.getUnlockEligibility(user+100,imei,att).hasTrustedResult,false)
})
test('newest observation wins across tables instead of independent numeric IDs', () => {
  const c=db(); const user=Number(c.prepare("INSERT INTO users(username,email,password_hash,status,account_type) VALUES('carrier-recency','carrier-recency@example.test','!test','active','customer')").run().lastInsertRowid)
  c.prepare("INSERT OR IGNORE INTO paid_report_products(code,slug,name,summary,price_cents) VALUES('APPLE_CARRIER_LITE','carrier-fixture','Carrier','fixture',100)").run()
  c.prepare("INSERT INTO paid_report_orders(id,user_id,product_code,product_name,imei_fingerprint,masked_imei,imei_encrypted,status,price_cents,report_json,completed_at) VALUES(90000,?,'APPLE_CARRIER_LITE','Carrier',?,'synthetic','!synthetic','completed',100,?,'2026-10-01 00:00:00')").run(user,fingerprintImei(imei),JSON.stringify(report('AT&T','postpaid')))
  c.prepare("INSERT INTO imei_checks(user_id,check_type,imei_fingerprint,masked_imei,status,result_json,updated_at) VALUES(?,'APPLE_CARRIER_LITE',?,'synthetic','completed',?,'2026-10-02 00:00:00')").run(user,fingerprintImei(imei),JSON.stringify({report:report('AT&T','prepaid')}))
  assert.equal(eligibility.getUnlockEligibility(user,imei,att).status,'unsupported')
})
