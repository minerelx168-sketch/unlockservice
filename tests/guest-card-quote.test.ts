import assert from 'node:assert/strict'
import test from 'node:test'
import { guestCardQuote } from '../lib/guest-card-quote'
test('direct card totals include the minimum service price and fee without a wallet allocation',()=>{
  for (const [price,total] of [[1,105],[15,105],[75,105],[100,105],[101,106],[1000,1050]]) {
    const quote=guestCardQuote(price)
    assert.equal(quote.totalCents,total)
    assert.equal(quote.walletCreditCents,0)
    assert.equal(quote.requiresAccount,false)
  }
  for (const price of [0,-1,1.1,NaN,Infinity]) assert.throws(()=>guestCardQuote(price))
})
