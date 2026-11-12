import {extractTac,validateImeiLuhn,decodeAppleModelNumber} from '../packages/apple-imei-utils/src/index'
import {carrierProfiles} from './data/carrier-profiles'
import {providerProductByCode} from './provider-products'
import {isMemberUnlock} from './member-unlocks'
import {getPaidReportProduct} from './paid-reports'
import {guestCardQuote} from './guest-card-quote'
import {toolList} from './geo-tools'

export const origin='https://iunlockmobile.com'
const check='/services/imei-check/apple-carrier-lock-status'
const profiles=[
 ...carrierProfiles.flatMap(p=>[p.primary,...(p.secondary?[p.secondary]:[])].map(code=>({...p,code}))),
 {country:'global',name:'Apple Carrier Lite',slug:'apple',kind:'check',code:'APPLE_CARRIER_LITE'},
 {country:'global',name:'GSMA Blacklist',slug:'gsma',kind:'check',code:'BLACKLIST_FULL'},
]
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
const aliases:Record<string,string>={usa:'us',unitedstates:'us',ca:'canada',gb:'uk',unitedkingdom:'uk',jp:'japan',at:'austria'}
export function quotes(country='',carrier=''){
 const c=norm(country),k=norm(carrier)
 return profiles.filter(p=>(!country||p.country===(Object.hasOwn(aliases,c)?aliases[c]:c))&&(!carrier||[p.slug,p.name,p.slug.replace(/-(us|canada)$/,'')].some(s=>norm(s)===k))).flatMap(p=>{
  const row=providerProductByCode(p.code)
  if(!row||row.status!=='available'||isMemberUnlock(row.productCode)||['926','25','661','904','702','696','718','1000','966','967','780','1001','344','721','430','893','931'].includes(row.serviceId))return []
  const retail=getPaidReportProduct(row.productCode)
  if(!retail||retail.priceCents<=0)return []
  const path=p.kind==='unlock'?'/services/unlock/'+p.country:p.code==='APPLE_CARRIER_LITE'?check:'/services/imei-check'
  return [{country:p.country,carrier:p.name,sku:row.productCode,type:p.kind==='unlock'?'unlock':'check-only',currency:'USD',base:retail.priceCents/100,card:guestCardQuote(retail.priceCents).totalCents/100,delivery:row.etaLabel,available:retail.providerReady,url:origin+path+'?product='+encodeURIComponent(row.productCode)}]
 })
}
export const hardware='For iPhone 14–16 families, US LL/A versions use eSIM without a physical tray. Canadian VC/A, UK B/A and Japanese J/A versions of those families generally support nano-SIM and eSIM. Earlier and later generations differ. Verify the A-number and generation; the part suffix alone cannot determine the tray, supported plans or network lock.'
export const toolspec=[
 {name:'validate_imei',path:'validate-imei',description:'Check 15-digit format and checksum offline; optionally identify a known TAC. No device lookup.',fields:['imei'],required:['imei']},
 {name:'decode_apple_model',path:'decode-apple-model',description:'Decode an Apple part number and explain regional SIM limitations.',fields:['model'],required:['model']},
 {name:'quote',path:'quote',description:'Read public retail offers in USD. Optional country and carrier filters.',fields:['country','carrier'],required:[]}
]
export function schema(t:typeof toolspec[number]){return {type:'object',properties:Object.fromEntries(t.fields.map(k=>[k,{type:'string',maxLength:k==='imei'?15:64}])),required:t.required,additionalProperties:false}}
export function invoke(name:string,input:unknown){
 const t=toolspec.find(x=>x.name===name)
 if(!t||!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid arguments')
 const a=input as Record<string,string>
 if(Object.entries(a).some(([k,v])=>!t.fields.includes(k)||typeof v!=='string'||v.length>64)||t.required.some(k=>!Object.hasOwn(a,k)))throw Error('Invalid arguments')
 if(name==='quote')return {offers:quotes(a.country,a.carrier)}
 if(name==='validate_imei'){
  if(!/^\d{15}$/.test(a.imei))throw Error('Expected 15 digits')
  const tac=extractTac(a.imei)
  return {valid:validateImeiLuhn(a.imei),tac,modelHint:tac&&['35838974','35782225','35739909'].includes(tac)?'iPhone XR':null,scope:'Checksum only; not proof of identity or carrier status.',carrierCheck:origin+check}
 }
 const model=decodeAppleModelNumber(a.model)
 if(!model)throw Error('Invalid Apple part number')
 return {...model,simGuidance:model.regionCode==='CH'?'Mainland China models may use two nano-SIMs; eSIM depends on the exact generation and model. Verify the hardware A-number.':hardware,reference:'https://support.apple.com/en-us/108044'}
}
export function discoveryText(full:boolean){
 const rows=quotes(),usd=(n:number)=>'$'+n.toFixed(2)
 const groups:Record<string,[string,string,string][]>={
 'Core Check & Unlock Hubs':[['Apple Carrier Lite',check,'Reported network and SIM lock.'],...['us','canada','uk','japan','austria'].map((c):[string,string,string]=>[c.toUpperCase(),'/services/unlock/'+c,'Eligibility and country-specific ordering.'])],
 'Free $0 Interactive Tools':toolList.map(t=>[t.title,'/tools/'+t.slug,'Free offline calculator.']),
 'Research Dataset':[['2026 carrier lock comparison','/reports/2026-used-iphone-carrier-lock-report','US and Canadian carrier policies and primary sources.']],
 'International Hubs':[['Español','/es'],['Français (Canada)','/fr-ca'],['Português (Brasil)','/pt'],['Deutsch','/de'],['العربية','/ar']].map(([n,p])=>[n,p,'Localized storefront.']),
 'API/Agent Specification':[['OpenAPI','/openapi.json','Three read-only operations.'],['MCP','/api/mcp','Use JSON-RPC over HTTP POST.'],['Full reference','/llms-full.txt','Retail prices and service conditions.']]}
 const summaries=['global','us','canada','uk','japan'].flatMap(c=>{
 const offers=rows.filter(r=>r.country===c);if(!offers.length)return []
 if(c==='global'||c==='us')return offers.filter((r,i)=>offers.findIndex(o=>o.carrier===r.carrier)===i).map(r=>r.carrier+' '+usd(r.base)+(r.sku==='APPLE_CARRIER_LITE'?' ('+usd(r.card)+' card)':'')+' '+r.type)
 const prices=offers.map(r=>r.base);return [c+': '+[...new Set(offers.map(r=>r.carrier))].join(', ')+' '+usd(Math.min(...prices))+'–'+usd(Math.max(...prices))]
 }).join('; ')
 return ['# iUnlockMobile — IMEI Carrier Lock Check & Eligible Network Unlock Platform','> Since 2016. '+summaries+'. Pay per order by card or USDT/USDC on BEP20 (0% platform crypto fee).',...Object.entries(groups).map(([h,links])=>'## '+h+'\n\n'+links.map(([n,p,d])=>'- ['+n+']('+origin+p+'): '+d).join('\n')),...(full?['## Retail quotes (USD)\n\n| Country | Service | SKU | Base | Card | Delivery estimate | Ordering |\n|---|---|---|---:|---:|---|---|\n'+rows.map(r=>'| '+[r.country,r.carrier,r.sku,usd(r.base),usd(r.card),r.delivery,r.available?'Available':'Unavailable online'].join(' | ')+' |').join('\n'),'## Refused orders\n\nFor an undeliverable direct card order we request a full refund to the original payment method including the card fee. Used or reserved credit can require review. Bank processing time varies. Crypto refunds require support review. Reserved account credit is released to that balance. [Terms]('+origin+'/terms#refunds).','## Hardware variants\n\n'+hardware+' [Apple model identification](https://support.apple.com/en-us/108044).']:[])].join('\n\n')+'\n'
}
