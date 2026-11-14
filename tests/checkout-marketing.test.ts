import assert from 'node:assert/strict'
import test from 'node:test'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {safeAnalyticsPage} from '../lib/analytics-page'
test('paid OpenAI is distinct from organic referral without sending the click reference',()=>{
 const url='https://iunlockmobile.com/services/unlock'
 const ad=safeAnalyticsPage(url+'?oppref=opaque','')
 assert.equal(ad.campaign_source,'openai');assert.equal(ad.campaign_medium,'paid');assert.equal(ad.page_location,url)
 assert.equal(safeAnalyticsPage(url,'https://chatgpt.com/').campaign_source,undefined)
 assert.equal(safeAnalyticsPage(url+'?oppref=opaque&gclid=google','').campaign_source,undefined)
 assert.equal(safeAnalyticsPage(url+'?oppref=opaque&utm_source=custom','').campaign_source,'custom')
})
test('consented checkout labels include safe campaigns without raw identifiers',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ga-labels-'));process.env.IUNLOCKMOBILE_DB=join(dir,'test.db')
 try {
 const {recordCheckoutContext,checkoutMarketingLabels}=await import('../lib/ga4')
 const c={oppref:'click-opaque',utmSource:'openai',utmCampaign:'us-unlock',utmContent:'490154203237518'}
 recordCheckoutContext('guest','one',null,'granted',null,{},c)
 assert.deepEqual(checkoutMarketingLabels('guest','one'),{checkout_click_channel:'openai_ads',checkout_utm_source:'openai',checkout_utm_campaign:'us-unlock'})
 recordCheckoutContext('guest','two',null,'denied',null,{},c)
 assert.equal(checkoutMarketingLabels('guest','two'),undefined)
 } finally {rmSync(dir,{recursive:true,force:true})}
})
