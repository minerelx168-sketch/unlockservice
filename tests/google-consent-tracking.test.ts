import test from 'node:test'
import assert from 'node:assert/strict'
import { updateGoogleConsent } from '../lib/google-consent-tracking'
test('consented landing keeps click ID once, strips private fields, and admin/staging stay excluded',()=>{
 const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document')
 const calls:unknown[][]=[]
 const browser={location:{hostname:'iunlockmobile.com',pathname:'/services/unlock',href:'https://iunlockmobile.com/services/unlock?imei=351212582890071&email=private@example.test'},dispatchEvent:()=>true,gtag:(...a:unknown[])=>{calls.push(a)}}
 const doc={documentElement:{dataset:{} as Record<string,string>},referrer:'https://www.google.com/search?q=private'}
 Object.defineProperty(globalThis,'window',{configurable:true,value:browser})
 Object.defineProperty(globalThis,'document',{configurable:true,value:doc})
 try {
  updateGoogleConsent('denied')
  assert.equal(calls.filter(c=>c[0]==='event').length,0)
  calls.length=0
  doc.documentElement.dataset.analyticsDisabled='true'
  updateGoogleConsent('granted',{gclid:'test-click-id'})
  assert.equal(calls.length,0)
  delete doc.documentElement.dataset.analyticsDisabled
  browser.location.hostname='staging.example.test'
  updateGoogleConsent('granted')
  assert.equal(calls.length,0)
  browser.location.hostname='iunlockmobile.com'
  updateGoogleConsent('granted',{gclid:'test-click-id'})
  updateGoogleConsent('granted',{gclid:'test-click-id'})
  const pageviews=calls.filter(c=>c[0]==='event'&&c[1]==='page_view')
  assert.equal(pageviews.length,1)
  assert.equal((pageviews[0][2] as {page_location:string}).page_location,'https://iunlockmobile.com/services/unlock?gclid=test-click-id')
  assert.equal(JSON.stringify(calls).includes('private@example.test'),false)
  assert.equal(JSON.stringify(calls).includes('351212582890071'),false)
 } finally {
  if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window')
  if(oldDocument)Object.defineProperty(globalThis,'document',oldDocument);else Reflect.deleteProperty(globalThis,'document')
 }
})
