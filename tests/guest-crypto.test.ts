import assert from 'node:assert/strict'
import { randomBytes,randomUUID } from 'node:crypto'
import { mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test,{before,after} from 'node:test'
const dir=mkdtempSync(join(tmpdir(),'guest-crypto-'))
const wallet='0x1111111111111111111111111111111111111111',sender='0x2222222222222222222222222222222222222222',contract='0x55d398326f99059ff775485246999027b3197955'
Object.assign(process.env,{IUNLOCKMOBILE_DB:join(dir,'test.db'),IUNLOCKMOBILE_WHOP_ENABLED:'0',IUNLOCKMOBILE_GUEST_CHECKOUT_ENABLED:'1',
  IUNLOCKMOBILE_TOPUP_ENABLED:'1',IUNLOCKMOBILE_TOPUP_BEP20_BSC_USD_ENABLED:'1',IUNLOCKMOBILE_EVM_RECEIVING_ADDRESS:wallet,IUNLOCKMOBILE_USDT_FEE_BPS:'0',
  RESEND_API_KEY:'test-only',IUNLOCKMOBILE_EMAIL_FROM:'support@example.test',IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET:'test-secret-for-guest-checkout-32-characters',
  IUNLOCKMOBILE_PROVIDER_MODE:'enabled',IUNLOCKMOBILE_PROVIDER_NAME:'test',IUNLOCKMOBILE_PROVIDER_URL:'https://provider.example.test/api',
  IUNLOCKMOBILE_PROVIDER_API_KEY:'test-only',IUNLOCKMOBILE_IMEI_SERVICE_MAP:JSON.stringify({'check:apple_carrier_lite':{id:'444',mode:'sync'}}),
  IUNLOCKMOBILE_PUBLIC_ORIGIN:'https://iunlockmobile.com',GA4_SERVER_PAYMENTS_ENABLED:'1',GA4_MEASUREMENT_API_SECRET:'test-only'})
let crypto:typeof import('../lib/guest-crypto'),guest:typeof import('../lib/guest-checkout'),db:typeof import('../lib/db'),credits:typeof import('../lib/credits'),payments:typeof import('../lib/payments'),verification:typeof import('../lib/payment-verification')
const originalFetch=globalThis.fetch,events:Record<string,unknown>[]=[],emails:Record<string,unknown>[]=[]
let providerCalls=0,providerFailure=false,head=114
const receipts=new Map<string,Record<string,unknown>>()
before(async()=>{
  crypto=await import('../lib/guest-crypto');guest=await import('../lib/guest-checkout');db=await import('../lib/db');credits=await import('../lib/credits');payments=await import('../lib/payments');verification=await import('../lib/payment-verification')
  globalThis.fetch=async(input,init)=>{
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url)
    if(url.hostname==='bsc-dataseed.bnbchain.org') {
      const body=JSON.parse(String(init?.body)),tag=body.params?.[0]
      const result=body.method==='eth_chainId'?'0x38':body.method==='eth_getTransactionReceipt'?receipts.get(tag)??null:
        body.method==='eth_blockNumber'?`0x${head.toString(16)}`:body.method==='eth_getBlockByNumber'?{number:tag==='finalized'?`0x${head.toString(16)}`:tag,
          hash:`0x${(tag==='finalized'?head:Number.parseInt(tag,16)).toString(16).padStart(64,'0')}`,timestamp:`0x${Math.floor(Date.now()/1000).toString(16)}`} : undefined
      if(result===undefined) throw new Error(`Unexpected chain call ${body.method}`)
      return Response.json({jsonrpc:'2.0',id:1,result})
    }
    if(url.hostname==='provider.example.test') {providerCalls++;return Response.json(providerFailure?{success:false,response:'Service unavailable',object:{}}:{success:true,response:'Model: iPhone 15\nSIM Lock: Unlocked',object:{Model:'iPhone 15','SIM Lock':'Unlocked'}})}
    if(url.hostname==='api.resend.com') {emails.push(JSON.parse(String(init?.body)));return Response.json({id:'email_test'})}
    if(url.hostname==='www.google-analytics.com') {events.push(JSON.parse(String(init?.body)));return new Response(null,{status:204})}
    throw new Error(`Unexpected network destination ${url.hostname}; crypto must not call Whop`)
  }
})
after(()=>{globalThis.fetch=originalFetch;db.db().close();rmSync(dir,{recursive:true,force:true})})
async function checkout(priceCents=15,extra:Record<string,unknown>={}) {
  db.db().prepare("UPDATE paid_report_products SET price_cents=?,is_active=1 WHERE code='APPLE_CARRIER_LITE'").run(priceCents)
  const input={productCode:'APPLE_CARRIER_LITE',imei:'490154203237518',email:`${randomUUID()}@example.test`,requestKey:randomUUID(),expectedPriceCents:priceCents,routeId:'bsc-usdt-peg',...extra}
  const result=await crypto.createGuestCryptoCheckout(input)
  const row=db.db().prepare('SELECT * FROM guest_checkouts WHERE request_key=?').get(input.requestKey) as import('../lib/guest-checkout').GuestCheckout
  return {input,result,row,key:new URL(result.url,'https://iunlockmobile.com').searchParams.get('key')!}
}
function transfer(row:import('../lib/guest-checkout').GuestCheckout,offsetE4=0) {
  const invoice=payments.getInvoice(row.crypto_invoice_reference!,row.user_id!)!
  db.db().prepare("UPDATE invoices SET created_at=datetime('now','-1 minute') WHERE reference=?").run(invoice.reference)
  const hash=`0x${randomBytes(32).toString('hex')}`,topic=(address:string)=>`0x${address.slice(2).padStart(64,'0')}`
  receipts.set(hash,{status:'0x1',blockNumber:'0x64',blockHash:`0x${(100).toString(16).padStart(64,'0')}`,transactionHash:hash,
    logs:[{address:contract,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',topic(sender),topic(wallet)],
      data:`0x${(BigInt(invoice.payment_amount_e4!+offsetE4)*10n**14n).toString(16)}`,logIndex:'0x0',removed:false}]})
  return hash
}
async function cycle(reference:string) {db.db().prepare("UPDATE guest_checkouts SET checked_at=datetime('now','-2 minutes') WHERE reference=?").run(reference);const result=await guest.processGuestCheckouts(10);assert.equal(result.errors,0)}
test('one-cent guest crypto has no minimum or merchant fee, leaves top-up limits unchanged, and needs no Whop',async()=>{
  assert.equal(guest.guestCheckoutEnabled(),false);assert.equal(crypto.guestCryptoEnabled(),true)
  const before=providerCalls,{row,input,result,key}=await checkout(1)
  assert.equal(row.fee_cents,0);assert.equal(row.payment_method,'crypto');assert.ok(row.user_id)
  assert.equal(row.payment_id,null);assert.equal(row.checkout_id,null)
  assert.equal(result.url.startsWith('/checkout/crypto/'),true)
  const status=await crypto.getGuestCryptoStatus(row.reference,key)
  assert.ok(status);assert.equal(status.deposit.requestedCents,1);assert.equal(status.deposit.feeCents,0);assert.equal(status.deposit.coded,true)
  assert.equal(status.order.paymentMethod,'crypto');assert.equal(status.order.paymentReceived,false)
  assert.equal(credits.getBalance(row.user_id!).availableCents,0)
  assert.equal(providerCalls,before);assert.equal(emails.length,0)
  assert.deepEqual(await crypto.createGuestCryptoCheckout(input),result)
  await assert.rejects(crypto.createGuestCryptoCheckout({...input,email:'changed@example.test'}),/different selection/)
  assert.throws(()=>payments.createInvoice(row.user_id!,'bsc-usdt-peg',1),/from \$1.00/)
  await assert.rejects(checkout(15,{routeId:'usdt-erc20'}),/available token/)
  await assert.rejects(checkout(15,{expectedPriceCents:1}),/price changed/)
  assert.equal(await crypto.getGuestCryptoStatus(row.reference,'0'.repeat(64)),null)
  assert.throws(()=>crypto.submitGuestCryptoTransaction(row.reference,'0'.repeat(64),'0x'+'1'.repeat(64)),/not found/)
  db.db().prepare("UPDATE guest_checkouts SET payment_method='card' WHERE reference=?").run(row.reference)
  assert.equal(await crypto.getGuestCryptoStatus(row.reference,key),null)
  assert.throws(()=>crypto.submitGuestCryptoTransaction(row.reference,key),/not found/)
  await assert.rejects(crypto.createGuestCryptoCheckout(input),/different selection/)
  db.db().prepare("UPDATE guest_checkouts SET payment_method='crypto' WHERE reference=?").run(row.reference)
})
test('confirmation threshold gates paid API; finalized crypto dispatches once without double credit or topup conversion',async()=>{
  const {row,key}=await checkout(15,{analytics:{clientId:'123.456',sessionId:'1780000000'}}),before=providerCalls
  await cycle(row.reference);assert.equal(providerCalls,before)
  const hash=transfer(row);crypto.submitGuestCryptoTransaction(row.reference,key,hash)
  head=100;assert.equal(await verification.verifyInvoiceTransaction(row.crypto_invoice_reference!),'confirming')
  await cycle(row.reference);assert.equal(providerCalls,before);assert.equal(guest.getGuestCheckout(row.reference)!.state,'pending')
  head=114;assert.equal(await verification.verifyInvoiceTransaction(row.crypto_invoice_reference!),'verified')
  const status=await crypto.getGuestCryptoStatus(row.reference,key)
  assert.equal(status?.order.paymentReceived,true);assert.equal(status?.order.state,'paid')
  await cycle(row.reference);await cycle(row.reference)
  const saved=guest.getGuestCheckout(row.reference)!
  assert.equal(providerCalls,before+1);assert.equal(guest.guestResult(saved).state,'completed')
  assert.equal(credits.getBalance(saved.user_id!).availableCents,0)
  assert.equal(db.db().prepare("SELECT 1 FROM credit_ledger WHERE user_id=? AND ref_type='guest_payment'").get(saved.user_id),undefined)
  assert.equal(db.db().prepare('SELECT 1 FROM payment_analytics WHERE invoice_reference=?').get(saved.crypto_invoice_reference),undefined)
  const sent=events.filter(event=>JSON.stringify(event).includes(`guest-${row.reference}`))
  assert.equal(sent.length,1);assert.equal(JSON.stringify(sent).includes('payment_completed'),false)
  assert.ok(emails.some(email=>String(email.text).includes(row.reference)&&String(email.text).includes('SIM Lock: Unlocked')))
  const other=await checkout(15)
  assert.throws(()=>crypto.submitGuestCryptoTransaction(other.row.reference,other.key,hash),/another|already|used/i)
})
test('a verified underpayment stays in review and never releases a supplier order',async()=>{
  const {row,key}=await checkout(150),before=providerCalls,hash=transfer(row,-5000)
  crypto.submitGuestCryptoTransaction(row.reference,key,hash)
  assert.equal(await verification.verifyInvoiceTransaction(row.crypto_invoice_reference!),'verified')
  await cycle(row.reference)
  const status=await crypto.getGuestCryptoStatus(row.reference,key)
  assert.equal(status?.deposit.status,'success');assert.equal(status?.deposit.creditedCents,100)
  assert.equal(status?.order.state,'review');assert.equal(status?.order.paymentReceived,false)
  assert.equal(guest.getGuestCheckout(row.reference)!.review_reason,'crypto_underpayment');assert.equal(providerCalls,before)
})
test('refused crypto service requests support refund without Whop or customer-wallet transfer',async()=>{
  const {row,key}=await checkout(15),hash=transfer(row)
  crypto.submitGuestCryptoTransaction(row.reference,key,hash)
  assert.equal(await verification.verifyInvoiceTransaction(row.crypto_invoice_reference!),'verified')
  // Represent the normal async-order case: the payment receipt was already delivered before a later refusal.
  db.db().prepare("UPDATE guest_checkouts SET receipt_sent_at=datetime('now') WHERE reference=?").run(row.reference)
  providerFailure=true;await cycle(row.reference);providerFailure=false;await cycle(row.reference)
  const saved=guest.getGuestCheckout(row.reference)!
  assert.equal(saved.state,'refund_pending');assert.equal(saved.refund_requested_at,null)
  assert.ok(saved.refund_notice_sent_at);assert.equal(saved.result_sent_at,null)
  const notices=emails.filter(email=>String(email.text).includes(row.reference)&&String(email.subject).includes('refund assistance'))
  assert.equal(notices.length,1);assert.equal(String(notices[0].text).includes('Contact support'),true)
  assert.equal(credits.getBalance(saved.user_id!).availableCents,15)
  assert.equal(guest.guestResult(saved).paymentMethod,'crypto')
  assert.equal(emails.some(email=>String(email.text).includes(row.reference)&&String(email.text).includes('original payment method')),false)
})
test('chain-confirmed guest payment is fulfilled even when its guest record passed the pending-age cutoff',async()=>{
  const {row,key}=await checkout(15),hash=transfer(row),before=providerCalls
  crypto.submitGuestCryptoTransaction(row.reference,key,hash)
  assert.equal(await verification.verifyInvoiceTransaction(row.crypto_invoice_reference!),'verified')
  db.db().prepare("UPDATE guest_checkouts SET created_at=datetime('now','-8 days') WHERE reference=?").run(row.reference)
  await cycle(row.reference)
  assert.equal(providerCalls,before+1);assert.equal(guest.getGuestCheckout(row.reference)!.state,'completed')
})

test('exhausted unique amount codes fail without creating an uncoded guest request',async()=>{
  const {row}=await checkout(100000),invoice=payments.getInvoice(row.crypto_invoice_reference!,row.user_id!)!
  const taken=invoice.payment_amount_e4!%100
  for(let code=1;code<=99;code++) {
    if(code===taken)continue
    db.db().prepare(`INSERT INTO invoices (reference,user_id,gateway,credit_amount_cents,fee_cents,tax_cents,total_due_cents,payment_route_id,payment_amount_e4)
      VALUES (?,?,?,100000,0,0,100000,?,?)`).run(randomBytes(16).toString('hex'),row.user_id,'bsc-usdt-peg','bsc-usdt-peg',10000000+code)
  }
  const users=(db.db().prepare('SELECT COUNT(*) AS n FROM users').get() as {n:number}).n
  await assert.rejects(checkout(100000),/temporarily unavailable for this amount/)
  assert.equal((db.db().prepare('SELECT COUNT(*) AS n FROM users').get() as {n:number}).n,users)
  assert.equal(db.db().prepare("SELECT 1 FROM guest_checkouts g JOIN invoices i ON i.reference=g.crypto_invoice_reference WHERE i.payment_amount_e4 IS NULL").get(),undefined)
})

