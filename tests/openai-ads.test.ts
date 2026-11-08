import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateOppref } from '../lib/attribution'
import { parseStoredLanding } from '../lib/landing-context'
const dir = mkdtempSync(join(tmpdir(), 'openai-ads-'))
process.env.IUNLOCKMOBILE_DB = join(dir, 'test.db')
let db: typeof import('../lib/db')['db']
let deliverOpenAiAds: typeof import('../lib/openai-ads')['deliverOpenAiAds']
before(async () => { ({ db } = await import('../lib/db')); ({ deliverOpenAiAds } = await import('../lib/openai-ads')) })
after(() => rmSync(dir, { recursive: true, force: true }))
let sequence = 0
let payloads: Record<string, unknown>[] = []
const transport: typeof fetch = async (_url, init) => { payloads.push(JSON.parse(String(init?.body))); return Response.json({}) }
beforeEach(() => {
  db().prepare("UPDATE ga4_checkout_context SET consent='denied'").run()
  db().prepare('DELETE FROM openai_conversion_delivery').run()
  payloads = []
  Object.assign(process.env, { OPENAI_ADS_MODE: 'live', OPENAI_ADS_PIXEL_ID: 'test-pixel-id', OPENAI_ADS_CAPI_KEY: 'test-only',
    OPENAI_ADS_START_AT: new Date(Date.now() - 86400000).toISOString(), IUNLOCKMOBILE_PUBLIC_ORIGIN: 'https://iunlockmobile.com' })
})
function fixture() {
  const key = 'ads-test-' + ++sequence
  const user = Number(db().prepare("INSERT INTO users(username,email,password_hash,account_type) VALUES(?,?,'unused','customer')").run(key, key + '@example.test').lastInsertRowid)
  const id = Number(db().prepare(`INSERT INTO orders(user_id,kind,imei,delivery_email,status,delivery,price_cents,eta_hours,idempotency_key)
    VALUES(?,'carrier_unlock','test','test@example.test','delivered','remote',800,1,?)`).run(user, key).lastInsertRowid)
  db().prepare("INSERT INTO invoices(reference,user_id,gateway,credit_amount_cents,total_due_cents,status) VALUES(?,?,'bsc_usdt',1000,1000,'success')").run(key, user)
  db().prepare("INSERT INTO credit_ledger(user_id,amount_cents,type,ref_type,ref_id,balance_after_cents) VALUES(?,1000,'topup','invoice',?,1000)").run(user, key)
  db().prepare("INSERT INTO credit_ledger(user_id,amount_cents,type,ref_type,ref_id,balance_after_cents) VALUES(?,-800,'charge','order',?,200)").run(user, String(id))
  db().prepare("INSERT INTO ga4_checkout_context(kind,reference,user_id,consent,gclid) VALUES('order',?,?,'granted','real-fixture-click')").run(key, user)
  const transactionId = 'unlock-' + id
  db().prepare('UPDATE ga4_checkout_context SET oppref=? WHERE reference=?').run('opaque-openai-test', key)
  return { key, user, id, transactionId }
}

function state(id: string) { return (db().prepare('SELECT state FROM openai_conversion_delivery WHERE transaction_id=?').get(id) as {state: string} | undefined)?.state }
test('concurrent workers send a verified paid purchase once, cents and stable GA4 transaction ID, no personal fields', async () => {
  const row = fixture()
  await Promise.all([deliverOpenAiAds(transport), deliverOpenAiAds(transport)])
  assert.equal(payloads.length, 1)
  const event = (payloads[0].events as Record<string, unknown>[])[0]
  assert.equal(event.id, row.transactionId)
  assert.equal(event.type, 'order_created')
  assert.deepEqual(event.data, {type:'contents', amount:800, currency:'USD'})
  assert.equal(event.oppref, 'opaque-openai-test')
  assert.equal(event.opt_out, true)
  assert.equal(event.user, undefined)
  assert.equal(state(row.transactionId), 'submitted')
  assert.equal((db().prepare('SELECT COUNT(*) n FROM ga4_events_sent').get() as {n:number}).n, 0)
  await deliverOpenAiAds(transport); assert.equal(payloads.length, 1)
})
test('real purchase without OpenAI reference is not manufactured from Google or organic traffic', async () => {
  const row = fixture(); db().prepare('UPDATE ga4_checkout_context SET oppref=NULL WHERE reference=?').run(row.key)
  await deliverOpenAiAds(transport); assert.equal(payloads.length,0)
})
test('refunds, unknown consent and mock orders are excluded', async () => {
  const refund = fixture(), unknown = fixture(), mock = fixture()
  db().prepare("INSERT INTO credit_ledger(user_id,amount_cents,type,ref_type,ref_id,balance_after_cents) VALUES(?,800,'refund','order',?,1000)").run(refund.user,String(refund.id))
  db().prepare("UPDATE ga4_checkout_context SET consent='unknown' WHERE reference=?").run(unknown.key)
  db().prepare("UPDATE orders SET provider_mode='mock' WHERE id=?").run(mock.id)
  await deliverOpenAiAds(transport); assert.equal(payloads.length,0)
})
test('validate-only mode never marks sent; withdrawal blocks later promotion', async () => {
  const row=fixture(); process.env.OPENAI_ADS_MODE='validate'
  await deliverOpenAiAds(transport)
  assert.equal(payloads[0].validate_only,true); assert.equal(state(row.transactionId),'validated')
  const {revokeCheckoutContext}=await import('../lib/ga4'); revokeCheckoutContext(row.user)
  process.env.OPENAI_ADS_MODE='live'; await deliverOpenAiAds(transport)
  assert.equal(payloads.length,1); assert.equal(state(row.transactionId),'suppressed')
  assert.equal((db().prepare('SELECT oppref FROM ga4_checkout_context WHERE reference=?').get(row.key) as {oppref:null}).oppref,null)
})
test('timeouts do not replay; changing destination does not resend validated purchases', async () => {
  const row=fixture(); await deliverOpenAiAds(async()=>{throw Error('timeout')})
  assert.equal(state(row.transactionId),'uncertain'); await deliverOpenAiAds(transport); assert.equal(payloads.length,0)
  const second=fixture(); process.env.OPENAI_ADS_MODE='validate'; await deliverOpenAiAds(transport)
  process.env.OPENAI_ADS_MODE='live'; process.env.OPENAI_ADS_PIXEL_ID='another-pixel'; await deliverOpenAiAds(transport)
  assert.equal(state(second.transactionId),'suppressed'); assert.equal(payloads.length,1)
})
test('post-delivery refund is flagged for review, never silently removed or replayed', async () => {
  const row=fixture(); await deliverOpenAiAds(transport)
  db().prepare("INSERT INTO credit_ledger(user_id,amount_cents,type,ref_type,ref_id,balance_after_cents) VALUES(?,800,'refund','order',?,1000)").run(row.user,String(row.id))
  await deliverOpenAiAds(transport)
  assert.equal(payloads.length,1)
  assert.equal((db().prepare('SELECT needs_review FROM openai_conversion_delivery WHERE transaction_id=?').get(row.transactionId) as {needs_review:string}).needs_review,'refunded')
})
test('capture preserves opaque reference and ad label, rejects malformed or expired input', () => {
  const now=Date.now(), ref='Opaque_abc/+=='; assert.equal(validateOppref(ref),ref)
  assert.equal(validateOppref('a\n'),undefined); assert.equal(validateOppref('user@example.com'),undefined)
  const raw=JSON.stringify({capturedAt:now,context:{oppref:ref,utmContent:'ad-1',email:'private'}})
  assert.deepEqual(parseStoredLanding(raw,now)?.context,{oppref:ref,utmContent:'ad-1'})
  assert.equal(parseStoredLanding(raw,now+30*86400000),null)
})

test('preflight always validates only, even in live mode, and has no click or user identifiers', async () => {
  const {validateOpenAiAds}=await import('../lib/openai-ads')
  assert.equal(await validateOpenAiAds(transport),true)
  assert.equal(payloads[0].validate_only,true)
  const event=(payloads[0].events as Record<string,unknown>[])[0]
  assert.equal(event.oppref,undefined); assert.equal(event.user,undefined)
})
test('database capture stores OpenAI references only with explicit consent and clears on withdrawal', async () => {
  const {recordCheckoutContext,revokeCheckoutContext}=await import('../lib/ga4')
  const row=fixture()
  for (const consent of ['granted','unknown','denied'] as const) {
    recordCheckoutContext('order',row.key+'-'+consent,row.user,consent,null,{}, {oppref:'Opaque-ref',utmContent:'ad-1'})
    const saved=db().prepare('SELECT oppref,utm_content FROM ga4_checkout_context WHERE reference=?').get(row.key+'-'+consent) as {oppref:string|null;utm_content:string|null}
    assert.equal(saved.oppref,consent==='granted'?'Opaque-ref':null)
    assert.equal(saved.utm_content,consent==='granted'?'ad-1':null)
  }
  revokeCheckoutContext(row.user)
  assert.equal((db().prepare('SELECT COUNT(*) n FROM ga4_checkout_context WHERE user_id=? AND oppref IS NOT NULL').get(row.user) as {n:number}).n,0)
})
