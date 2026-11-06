import assert from 'node:assert/strict'
import test from 'node:test'
import { rememberLanding, persistLanding, readLanding, forgetLanding, parseStoredLanding } from '../lib/landing-context'
import { ATTRIBUTION_MAX_AGE_SECONDS } from '../lib/attribution'

test('landing survives a new tab only after consent, direct visits preserve it, campaigns replace it', () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window'), oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const storage = new Map<string,string>(); let cookie = ''
  const browser = { iunlockmobileAnalyticsConsent: 'unknown', sessionStorage: { getItem: (k:string) => storage.get(k) ?? null, setItem: (k:string,v:string) => storage.set(k,v), removeItem: (k:string) => storage.delete(k) } }
  Object.defineProperty(globalThis, 'window', { configurable:true, value:browser })
  Object.defineProperty(globalThis, 'document', { configurable:true, value: { get cookie() { return cookie }, set cookie(v:string) { cookie = v.includes('Max-Age=0;') ? '' : v.split(';')[0] } } })
  try {
    rememberLanding('/services',new URLSearchParams('gclid=click-1&utm_source=google&utm_medium=cpc'))
    assert.equal(cookie,'')
    browser.iunlockmobileAnalyticsConsent='granted'; persistLanding(); assert.ok(cookie)
    storage.clear(); rememberLanding('/',new URLSearchParams())
    assert.equal(readLanding().gclid,'click-1'); assert.equal(readLanding().landingPage,'/services')
    rememberLanding('/articles',new URLSearchParams('utm_source=newsletter&utm_medium=email'))
    assert.equal(readLanding().gclid,undefined); assert.equal(readLanding().utmSource,'newsletter')
    forgetLanding(); assert.deepEqual(readLanding(),{}); assert.equal(cookie,'')
  } finally {
    if(oldWindow) Object.defineProperty(globalThis,'window',oldWindow); else Reflect.deleteProperty(globalThis,'window')
    if(oldDocument) Object.defineProperty(globalThis,'document',oldDocument); else Reflect.deleteProperty(globalThis,'document')
  }
})
test('30-day expiry is absolute; forged times and unapproved payload fields are rejected', () => {
  const now = Date.now(), context = {gclid:'abc',email:'private@example.test',landingPage:'/checkout?imei=123'}
  assert.equal(ATTRIBUTION_MAX_AGE_SECONDS,30*86400)
  assert.deepEqual(parseStoredLanding(JSON.stringify({capturedAt:now,context}),now)?.context,{gclid:'abc'})
  assert.equal(parseStoredLanding(JSON.stringify({capturedAt:now,context}),now+30*86400*1000),null)
  assert.equal(parseStoredLanding(JSON.stringify({capturedAt:now+1,context}),now),null)
})
