import test from 'node:test'
import assert from 'node:assert/strict'
import { paymentAnalyticsContext } from '../lib/payment-analytics-client'
test('checkout waits for existing consent initialization, uses actual GA IDs and honors refusal',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'window')
 const target=new EventTarget()
 const browser={location:{hostname:'iunlockmobile.com'},iunlockmobileAnalyticsConsent:undefined as string|undefined,
 addEventListener:target.addEventListener.bind(target),removeEventListener:target.removeEventListener.bind(target),
 gtag:(_a:string,_b:string,field:string,callback:(v:string)=>void)=>callback(field==='client_id'?'123.456':'123')}
 Object.defineProperty(globalThis,'window',{configurable:true,value:browser})
 try {
  const pending=paymentAnalyticsContext()
  browser.iunlockmobileAnalyticsConsent='granted';target.dispatchEvent(new Event('iunlockmobile-consent'))
  assert.deepEqual(await pending,{clientId:'123.456',sessionId:'123'})
  browser.iunlockmobileAnalyticsConsent='denied'
  browser.gtag=()=>{throw new Error('must not read IDs after refusal')}
  assert.equal(await paymentAnalyticsContext(),undefined)
 } finally {if(old)Object.defineProperty(globalThis,'window',old);else Reflect.deleteProperty(globalThis,'window')}
})
