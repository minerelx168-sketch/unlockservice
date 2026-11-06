import assert from 'node:assert/strict'
import test, {after} from 'node:test'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const dir=mkdtempSync(join(tmpdir(),'ads-outbox-'))
process.env.IUNLOCKMOBILE_DB=join(dir,'test.db')
after(()=>rmSync(dir,{recursive:true,force:true}))
test('staging is idempotent, excludes denied/internal/organic visits, and consent withdrawal clears click IDs',async()=>{
 const {db}=await import('../lib/db'); const {stageAdsPurchase}=await import('../lib/ads-conversion-outbox'); const {revokeCheckoutContext}=await import('../lib/ga4')
 const body={events:[{name:'purchase',params:{currency:'USD',value:4.99,gross_margin:4.94,email:'never-export@example.test'}}]}
 for(const [ref,consent,internal,gclid] of [['paid','granted',0,'abc'],['denied','denied',0,'abc'],['internal','granted',1,'abc'],['organic','granted',0,null],['unknown','unknown',0,'abc']] as const){
  db().prepare('INSERT INTO ga4_checkout_context(kind,reference,user_id,consent,internal,gclid) VALUES(\'guest\',?,123,?,?,?)').run(ref,consent,internal,gclid)
  const event={transactionId:'guest-'+ref,eventName:'purchase',kind:'guest',paidAt:'2026-11-06 10:00:00',contextReference:ref}
  stageAdsPurchase(event,body);stageAdsPurchase(event,body)
 }
 const rows=db().prepare('SELECT * FROM ads_conversion_outbox').all() as {revenue_cents:number;gross_margin_cents:number;state:string;click_id:string}[]
 assert.equal(rows.length,1);assert.equal(rows[0].revenue_cents,499);assert.equal(rows[0].gross_margin_cents,494);assert.equal(rows[0].state,'awaiting_configuration')
 assert.ok(!JSON.stringify(rows).includes('never-export'))
 revokeCheckoutContext(123)
 const row=db().prepare('SELECT state,click_id FROM ads_conversion_outbox').get() as {state:string;click_id:string}
 assert.equal(row.state,'suppressed');assert.equal(row.click_id,'')
})
