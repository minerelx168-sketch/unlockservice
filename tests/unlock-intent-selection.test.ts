import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { deviceDomain, deviceImei, deviceEmail } from '../lib/device-intent-value'
import { withContinuation } from '../lib/continuation'

// Execute the server action with boundary adapters; never call a provider or real cookies.
function actionHarness(guestEnabled = false, cryptoEnabled = false, priceCents = 1000, accountType: string | null = null) {
  const writes: unknown[][] = []
  const products = [{ productCode: 'UNLOCK_ACTIVE', status: 'available' }, { productCode: 'UNLOCK_PAUSED', status: 'coming_soon' }]
  const moduleRecord = { exports: {} as { showUnlockServicesAction: (state: object, form: FormData) => Promise<{ error?: string }>; continueDeviceServiceAction: (state: object, form: FormData) => Promise<{ error?: string }>; prepareSmallCardAccountAction: (value: {productCode:string;imei:string;email:string;domain:'unlock'|'imei_check'})=>Promise<{error?:string;url?:string}> } }
  const realRequire = createRequire(import.meta.url)
  const mocks: Record<string, unknown> = {
    'next/navigation': { redirect: (url: string) => { throw new Error(`REDIRECT:${url}`) } },
    './auth': { currentSession: async () => accountType ? { user: { account_type: accountType } } : null },
    './guest-checkout': { guestCheckoutEnabled: () => guestEnabled },
    './guest-crypto': { guestCryptoEnabled: () => cryptoEnabled },
    './continuation': { withContinuation },
    './device-intent': { writeDeviceIntent: async (...args: unknown[]) => { writes.push(args) } },
    './device-intent-value': { deviceDomain, deviceImei, deviceEmail },
    './paid-reports': { listPaidReportProducts: () => [{code:'UNLOCK_ACTIVE',domain:'unlock',providerReady:true,priceCents}] },
    './public-provider-catalog': { listPublicProviderProducts: (domain: string) => domain === 'unlock' ? products : [] },
  }
  const code = ts.transpileModule(readFileSync('lib/device-intent-actions.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { module: moduleRecord, exports: moduleRecord.exports, require: (name: string) => mocks[name] ?? realRequire(name) })
  return { action: moduleRecord.exports.showUnlockServicesAction, continueAction:moduleRecord.exports.continueDeviceServiceAction, prepareAction:moduleRecord.exports.prepareSmallCardAccountAction, writes }
}
function form(imei: string, code?: string) {
  const data = new FormData()
  data.set('imei', imei)
  if (code !== undefined) data.set('productCode', code)
  data.set('priceCents', '1')
  return data
}

test('the selected active service survives the validated IMEI handoff without trusting a client price', async () => {
  const { action, writes } = actionHarness()
  await assert.rejects(action({}, form('49 015420 323751 8', 'UNLOCK_ACTIVE')), /REDIRECT:\/services\/unlock\/catalog/)
  assert.equal(writes.length, 1)
  assert.equal(writes[0][0], '490154203237518')
  assert.equal(writes[0][1], 'unlock')
  assert.equal(writes[0][2], 'UNLOCK_ACTIVE')
  assert.equal(writes[0].length, 3)
})
test('invalid IMEIs and unavailable or unknown services never replace the saved selection', async () => {
  for (const [imei, code] of [['490154203237519', 'UNLOCK_ACTIVE'], ['490154203237518', 'UNLOCK_PAUSED'], ['490154203237518', 'NOT_A_PRODUCT'], ['490154203237518', '']]) {
    const { action, writes } = actionHarness()
    const result = await action({}, form(imei, code))
    assert.ok(result.error)
    assert.equal(writes.length, 0)
  }
})
test('the existing IMEI-only entry continues to open the catalog', async () => {
  const { action, writes } = actionHarness()
  await assert.rejects(action({}, form('490154203237518')), /REDIRECT:\/services\/unlock\/catalog/)
  assert.equal(writes.length, 1)
  assert.equal(writes[0][2], undefined)
})

test('guest service navigation preserves IMEI and email once, without creating an order', async () => {
  const {continueAction,writes}=actionHarness(true)
  const data=form('49 015420 323751 8','UNLOCK_ACTIVE')
  data.set('domain','unlock');data.set('email',' Buyer@Example.com ')
  await assert.rejects(continueAction({},data),/REDIRECT:\/checkout\?product=UNLOCK_ACTIVE/)
  assert.deepEqual(Array.from(writes[0]),['490154203237518','unlock','UNLOCK_ACTIVE','buyer@example.com'])
  assert.equal(writes.length,1)
})

test('invalid delivery email cannot overwrite the existing checkout draft', async () => {
  const {continueAction,writes}=actionHarness(true)
  const data=form('490154203237518','UNLOCK_ACTIVE')
  data.set('domain','unlock');data.set('email','bad email')
  assert.ok((await continueAction({},data)).error)
  assert.equal(writes.length,0)
})

test('crypto navigation preserves the draft and payment choice even when card checkout is disabled', async () => {
  const {continueAction,writes}=actionHarness(false,true)
  const data=form('490154203237518','UNLOCK_ACTIVE')
  data.set('domain','unlock');data.set('email','buyer@example.com');data.set('paymentMethod','crypto')
  await assert.rejects(continueAction({},data),/REDIRECT:\/checkout\?product=UNLOCK_ACTIVE&method=crypto$/)
  assert.deepEqual(Array.from(writes[0]),['490154203237518','unlock','UNLOCK_ACTIVE','buyer@example.com'])
})

test('unavailable crypto does not silently switch the payment method or overwrite the draft', async () => {
  const {continueAction,writes}=actionHarness(true,false)
  const data=form('490154203237518','UNLOCK_ACTIVE')
  data.set('domain','unlock');data.set('email','buyer@example.com');data.set('paymentMethod','crypto')
  assert.match((await continueAction({},data)).error??'',/temporarily unavailable/)
  assert.equal(writes.length,0)
})

test('a card service below $1 saves the draft and resumes checkout after signup', async () => {
  const {continueAction,writes}=actionHarness(true,true,75)
  const data=form('490154203237518','UNLOCK_ACTIVE')
  data.set('domain','unlock');data.set('email','buyer@example.com');data.set('paymentMethod','card')
  await assert.rejects(continueAction({},data),/REDIRECT:\/register\?next=%2Fcheckout%3Fproduct%3DUNLOCK_ACTIVE%26method%3Dcard$/)
  assert.deepEqual(Array.from(writes[0]),['490154203237518','unlock','UNLOCK_ACTIVE','buyer@example.com'])
  assert.equal(writes.length,1)
})

test('signed-in small card customers and all crypto guests proceed without signup', async () => {
  for (const [method,account] of [['card','customer'],['crypto',null]] as const) {
    const {continueAction,writes}=actionHarness(true,true,75,account)
    const data=form('490154203237518','UNLOCK_ACTIVE')
    data.set('domain','unlock');data.set('email','buyer@example.com');data.set('paymentMethod',method)
    await assert.rejects(continueAction({},data),method==='crypto'?/REDIRECT:\/checkout\?product=UNLOCK_ACTIVE&method=crypto$/:/REDIRECT:\/checkout\?product=UNLOCK_ACTIVE$/)
    assert.equal(writes.length,1)
  }
})

test('admin small card checkout cannot loop through registration or overwrite the draft', async () => {
  const {continueAction,writes}=actionHarness(true,true,75,'admin')
  const data=form('490154203237518','UNLOCK_ACTIVE')
  data.set('domain','unlock');data.set('email','buyer@example.com');data.set('paymentMethod','card')
  assert.match((await continueAction({},data)).error??'',/customer account/)
  assert.equal(writes.length,0)
})

test('direct checkout account handoff returns a navigation URL without throwing or losing edited details', async () => {
  for (const accountType of [null,'customer']) {
    const {prepareAction,writes}=actionHarness(true,true,75,accountType)
    const result=await prepareAction({productCode:'UNLOCK_ACTIVE',imei:'49 015420 323751 8',email:'Edited@Example.com',domain:'unlock'})
    assert.equal(result.url,accountType?'/checkout?product=UNLOCK_ACTIVE&method=card':'/register?next=%2Fcheckout%3Fproduct%3DUNLOCK_ACTIVE%26method%3Dcard')
    assert.deepEqual(Array.from(writes[0]),['490154203237518','unlock','UNLOCK_ACTIVE','edited@example.com'])
  }
  const unavailable=actionHarness(false,true,75)
  assert.ok((await unavailable.prepareAction({productCode:'UNLOCK_ACTIVE',imei:'490154203237518',email:'buyer@example.com',domain:'unlock'})).error)
  assert.equal(unavailable.writes.length,0)
})
