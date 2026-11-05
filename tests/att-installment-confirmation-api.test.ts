import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { assertAttInstallmentConfirmation, assertAttInstallmentConfirmationForTrustedName, AttInstallmentConfirmationError } from '../lib/att-installment-confirmation'
function harness(kind: 'guest' | 'crypto') {
  let creations = 0, analytics = 0
  class PaymentError extends Error { constructor(message:string, readonly status=400, readonly code?:string) {super(message)} }
  const create = async () => {creations++; return {reference:'synthetic',url:'https://whop.com/checkout/synthetic'}}
  const mocks: Record<string,unknown> = {
    '@/lib/att-installment-confirmation': {assertAttInstallmentConfirmation, assertAttInstallmentConfirmationForTrustedName, AttInstallmentConfirmationError},
    'next/server': {NextResponse:{json:(body:unknown,opts?:ResponseInit)=>Response.json(body,opts)}},
    'next/headers': {cookies:async()=>({get:()=>undefined})},
    'node:crypto': {createHash:()=>({update:()=>({digest:()=> 'synthetic-ip-hash'})})},
    '@/lib/guest-checkout': {createGuestCheckout:create}, '@/lib/guest-crypto': {createGuestCryptoCheckout:create},
    '@/lib/whop': {WhopPaymentError:PaymentError}, '@/lib/request-json': {readCommandJson:(r:Request)=>r.json()},
    '@/lib/site': {publicOrigin:()=> 'https://iunlockmobile.com'}, '@/lib/rate-limit': {consumeAttempt:()=>true},
    '@/lib/cookie-names': {CONSENT_COOKIE:'consent'}, '@/lib/order-attribution': {parseSignedConsent:()=>({consent:'denied'})},
    '@/lib/auth': {currentSession:async()=>null}, '@/lib/checkout-context-request': {captureCheckoutContext:async()=>{analytics++}},
    '@/lib/payment-diagnostics': {logPaymentFailure:()=>{}}, '@/lib/checkout-reminders': {requestCheckoutReminderOptIn:()=>{}},
  }
  const moduleRecord = {exports:{} as {POST:(r:Request)=>Promise<Response>}}
  const source = ts.transpileModule(readFileSync(`app/api/checkout/${kind}/route.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  vm.runInNewContext(source,{module:moduleRecord,exports:moduleRecord.exports,require:(name:string)=>{if(!(name in mocks))throw new Error('Unexpected import: '+name);return mocks[name]}})
  return {post:moduleRecord.exports.POST, counts:()=>({creations,analytics})}
}
for (const kind of ['guest','crypto'] as const) test(`${kind} HTTP checkout cannot bypass AT&T confirmation using client name or a reused key`,async()=>{
  const h=harness(kind)
  const post=(value:unknown)=>h.post(new Request('https://iunlockmobile.com/api/checkout/'+kind,{method:'POST',headers:{Origin:'https://iunlockmobile.com','Content-Type':'application/json'},body:JSON.stringify({productCode:'UNLOCK_346',carrier:'C Spire',acceptedTerms:true,requestKey:'reused-key',attInstallmentConfirmation:value})}))
  for(const value of [undefined,false,'true',1]){const r=await post(value);assert.equal(r.status,400);assert.equal((await r.json()).code,'att_installment_confirmation_required')}
  assert.deepEqual(h.counts(),{creations:0,analytics:0})
  const accepted=await post(true);assert.equal(accepted.status,200);assert.equal(h.counts().creations,1)
})
