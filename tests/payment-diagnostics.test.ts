import test from 'node:test'
import assert from 'node:assert/strict'
import {paymentFailure,logPaymentFailure} from '../lib/payment-diagnostics'
test('keeps status and network cause but never provider payload or secrets',()=>{
 const x=paymentFailure('guest.list',{name:'WhopError',statusCode:429,message:'secret@example.com',body:{token:'secret'},headers:{authorization:'secret'},cause:{code:'ECONNRESET'}})
 assert.equal(x.http_status,429); assert.equal(x.error_code,'ECONNRESET'); assert.ok(!JSON.stringify(x).includes('secret'))
})
test('rejects arbitrary error labels and invalid status',()=>{
 const x=paymentFailure('whop.retrieve',{name:'user@example.com',code:'private-key',status:700})
 assert.equal(x.error_type,'OtherError');assert.equal(x.error_code,null);assert.equal(x.http_status,null)
})
test('hostile getters and logging failures cannot escape',()=>{
 const e=Object.defineProperty({},'name',{get(){throw new Error('secret')}})
 assert.doesNotThrow(()=>paymentFailure('guest.list',e))
 const old=console.error; console.error=()=>{throw new Error('log unavailable')}
 try {assert.doesNotThrow(()=>logPaymentFailure('guest.list',e))} finally {console.error=old}
})
