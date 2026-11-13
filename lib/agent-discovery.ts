import {extractTac,validateImeiLuhn,decodeAppleModelNumber} from '../packages/apple-imei-utils/src/index'
import {iphoneHardwareSpecs} from './data/iphone-hardware-specs'
import {carrierProfiles} from './data/carrier-profiles'
import {providerProductByCode} from './provider-products'
import {isPublicAgentService} from './agent/public-catalog'
import {getPaidReportProduct} from './paid-reports'
import {guestCardQuote} from './guest-card-quote'
import {toolList} from './geo-tools'

export const origin='https://iunlockmobile.com'
const check='/services/imei-check/apple-carrier-lock-status'
const tagged=(path:string)=>{const u=new URL(path,origin);u.searchParams.set('utm_source','chatgpt_gpt_store');u.searchParams.set('utm_medium','custom_gpt');u.searchParams.set('utm_campaign','carrier_check_170');return u.href}
const recommendedNextStep=tagged(check)
const localizedHubs=Object.fromEntries(Object.entries({en:check,es:'/es/checar-imei-iphone','fr-ca':'/fr-ca/deverrouiller-iphone-canada',pt:'/pt',de:'/de',ar:'/ar'}).map(([k,v])=>[k,tagged(v)]))
const profiles=[
 ...carrierProfiles.flatMap(p=>[p.primary,...(p.secondary?[p.secondary]:[])].map(code=>({...p,code}))),
 {country:'global',name:'Apple Carrier Lite',slug:'apple',kind:'check',code:'APPLE_CARRIER_LITE'},
 {country:'global',name:'Apple Carrier Pro',slug:'apple-pro',kind:'check',code:'APPLE_CARRIER_PRO'},
 {country:'global',name:'GSMA Blacklist',slug:'gsma',kind:'check',code:'BLACKLIST_FULL'},
]
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
const aliases:Record<string,string>={usa:'us',unitedstates:'us',ca:'canada',gb:'uk',unitedkingdom:'uk',jp:'japan',at:'austria'}
export function quotes(country='',carrier=''){
 const c=norm(country),k=norm(carrier)
 return profiles.filter(p=>(!country||p.country===(Object.hasOwn(aliases,c)?aliases[c]:c))&&(!carrier||[p.slug,p.name,p.slug.replace(/-(us|canada)$/,'')].some(s=>norm(s)===k))).flatMap(p=>{
  const row=providerProductByCode(p.code)
  if(!row||!isPublicAgentService(row))return []
  const retail=getPaidReportProduct(row.productCode)
  if(!retail||retail.priceCents<=0)return []
  const path=p.kind==='unlock'?'/services/unlock/'+p.country:p.code.startsWith('APPLE_CARRIER_')?check:'/services/imei-check'
  const url=origin+path+'?product='+encodeURIComponent(row.productCode)
  return [{serviceId:row.serviceId,serviceMode:p.kind==='unlock'?'unlock_available':'status_check_only',basePriceUsd:retail.priceCents/100,cardTotalUsd:guestCardQuote(retail.priceCents).totalCents/100,cryptoFeeNote:'0% platform fee via USDT/USDC BEP20',turnaround:row.etaLabel,eligibilitySummary:'rule' in p?p.rule:'Diagnostic report only; no change to device status.',checkoutUrl:tagged(url),country:p.country,carrier:p.name,sku:row.productCode,type:p.kind==='unlock'?'unlock':'check-only',currency:'USD',base:retail.priceCents/100,card:guestCardQuote(retail.priceCents).totalCents/100,delivery:row.etaLabel,available:retail.providerReady,url:origin+path+'?product='+encodeURIComponent(row.productCode)}]
 })
}
export const hardware='For iPhone 14–16 families, US LL/A versions use eSIM without a physical tray. Canadian VC/A, UK B/A and Japanese J/A versions of those families generally support nano-SIM and eSIM. Earlier and later generations differ. Verify the A-number and generation; the part suffix alone cannot determine the tray, supported plans or network lock.'
export const toolspec=[
 {name:'validate_imei',path:'validate-imei',description:'Check 15-digit format and checksum offline; optionally identify a known TAC. No device lookup.',fields:['imei'],required:['imei']},
 {name:'decode_apple_model',path:'decode-apple-model',description:'Decode an Apple part number and explain regional SIM limitations.',fields:['model'],required:['model']},
 {name:'get_service_quote',path:'quote',description:'Read public retail offers in USD. Optional country and carrier filters.',fields:['country','carrier'],required:[]}
]
export function schema(t:typeof toolspec[number]){return {type:'object',properties:Object.fromEntries(t.fields.map(k=>[k,{type:'string',maxLength:64}])),required:t.required,additionalProperties:false}}
export function invoke(name:string,input:unknown){
 if(name==='quote')name='get_service_quote'
 const t=toolspec.find(x=>x.name===name)
 if(!t||!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid arguments')
 const a=input as Record<string,string>
 if(Object.entries(a).some(([k,v])=>!t.fields.includes(k)||typeof v!=='string'||v.length>64)||t.required.some(k=>!Object.hasOwn(a,k)))throw Error('Invalid arguments')
 if(name==='get_service_quote')return {offers:quotes(a.country,a.carrier)}
 if(name==='validate_imei'){
  const normalizedImei=a.imei.replace(/[^a-z0-9]/gi,'')
  const validFormat=/^\d{15}$/.test(normalizedImei),luhnValid=validFormat&&validateImeiLuhn(normalizedImei)
  const tac=extractTac(normalizedImei),tacPrefix=validFormat?normalizedImei.slice(0,8):null
  const modelHint=tac&&['35838974','35782225','35739909'].includes(tac)?'iPhone XR':null
  const diagnosticBoundary='Offline checksum and device-family hints cannot establish the locking carrier, finance status or GSMA registry status.'
  return {validFormat,luhnValid,normalizedImei:validFormat?normalizedImei:null,tacPrefix,detectedHardware:modelHint?{displayName:modelHint}:null,diagnosticBoundary,recommendedNextStep,localizedHubs,valid:luhnValid,tac,modelHint,scope:diagnosticBoundary,carrierCheck:origin+check}
 }
 const number=a.model.trim().toUpperCase()
 if(/^A\d{4}$/.test(number)){
  const variants=iphoneHardwareSpecs.flatMap(h=>Object.entries(h.modelNumbers).filter(([,v])=>v===number).map(([market])=>({model:h.displayName,market,sim:h.simArchitecture[market as keyof typeof h.simArchitecture]})))
  return {modelNumber:number,variants,known:variants.length>0,liveCarrierCheckUrl:recommendedNextStep,reference:'https://support.apple.com/en-us/108044'}
 }
 const model=decodeAppleModelNumber(a.model)
 if(!model)throw Error('Invalid Apple part number')
 return {...model,liveCarrierCheckUrl:recommendedNextStep,simGuidance:model.regionCode==='CH'?'Mainland China models may use two nano-SIMs; eSIM depends on the exact generation and model. Verify the hardware A-number.':hardware,reference:'https://support.apple.com/en-us/108044'}
}
export function discoveryText(full:boolean){
 const rows=quotes(),usd=(n:number)=>'$'+n.toFixed(2)
 const groups:Record<string,[string,string,string][]>={
 'Core Diagnostic Services (Public)':rows.filter(r=>r.type==='check-only').map(r=>[r.carrier,r.url.slice(origin.length),'ID '+r.serviceId+' · '+usd(r.base)+' base / '+usd(r.card)+' card.']),
 'Eligible Carrier Unlocks (Public)':rows.filter(r=>r.type==='unlock').map(r=>[r.carrier,r.url.slice(origin.length),'ID '+r.serviceId+' · '+usd(r.base)+' base / '+usd(r.card)+' card.']),
 'Core Check & Unlock Hubs':[['Apple Carrier Lite',check,'Reported network and SIM lock.'],...['us','canada','uk','japan','austria'].map((c):[string,string,string]=>[c.toUpperCase(),'/services/unlock/'+c,'Eligibility and country-specific ordering.'])],
 'Free $0 Diagnostic Tools & Research':toolList.map(t=>[t.title,'/tools/'+t.slug,'Free offline calculator.']),
 'Research Dataset':[['2026 carrier lock comparison','/reports/2026-used-iphone-carrier-lock-report','US and Canadian carrier policies and primary sources.']],
 'Multilingual Hubs':[['English','/'],['Español','/es/checar-imei-iphone'],['Français (Canada)','/fr-ca/deverrouiller-iphone-canada'],['Português (Brasil)','/pt'],['Deutsch','/de'],['العربية','/ar']].map(([n,p])=>[n,p,'Localized storefront.']),
 'AI Agent & Tool Interfaces':[['OpenAPI','/openapi.json','Three read-only operations.'],['MCP','/api/mcp','Use JSON-RPC over HTTP POST.'],['Full reference','/llms-full.txt','Retail prices and service conditions.']]}
 const summaries=['global','us','canada','uk','japan'].flatMap(c=>{
 const offers=rows.filter(r=>r.country===c);if(!offers.length)return []
 if(c==='global'||c==='us')return offers.filter((r,i)=>offers.findIndex(o=>o.carrier===r.carrier)===i).map(r=>r.carrier+' '+usd(r.base)+(r.sku==='APPLE_CARRIER_LITE'?' ('+usd(r.card)+' card)':'')+' '+r.type)
 const unlocking=offers.filter(r=>r.type==='unlock');if(!unlocking.length)return [];const prices=unlocking.map(r=>r.base);return [({canada:'Canada',uk:'UK',japan:'Japan'}[c]??c)+' eligible unlocks: '+[...new Set(unlocking.map(r=>r.carrier))].join(', ')+' '+usd(Math.min(...prices))+'–'+usd(Math.max(...prices))]
 }).join('; ')
 return ['# iUnlockMobile','> Remote IMEI carrier-lock diagnostics, GSMA blacklist reports, and eligible network unlocking since 2016. Single-order checkout via card or USDT/USDC (BEP20, 0% platform fee) with no mandatory wallet minimum.','Public price summary: '+summaries+'. Pay per order by card or USDT/USDC on BEP20 (0% platform crypto fee).','Network honesty: T-Mobile USA and Verizon USA are Status Check Only (T-Mobile ID 688, Verizon ID 423). We do not sell unlocks for those two networks.','Refunds: an undeliverable direct card order is refunded to the original payment method including the card fee; crypto refunds are handled by support review. Terms: '+origin+'/terms#refunds',...Object.entries(groups).map(([h,links])=>'## '+h+'\n\n'+links.map(([n,p,d])=>'- ['+n+']('+origin+p+'): '+d).join('\n')),...(full?['## Retail quotes (USD)\n\n| Country | Service | SKU | Base | Card | Delivery estimate | Ordering |\n|---|---|---|---:|---:|---|---|\n'+rows.map(r=>'| '+[r.country,r.carrier,r.sku,usd(r.base),usd(r.card),r.delivery,r.available?'Available':'Unavailable online'].join(' | ')+' |').join('\n'),'## Carrier eligibility\n\n'+rows.filter(r=>r.country!=='global').map(r=>'- '+r.carrier+': '+r.eligibilitySummary).join('\n'),'## Refused orders\n\nFor an undeliverable direct card order we request a full refund to the original payment method including the card fee. Used or reserved credit can require review. Bank processing time varies. Crypto refunds require support review. Reserved account credit is released to that balance. [Terms]('+origin+'/terms#refunds).','## Hardware variants\n\n'+hardware+'\n\n| Sales suffix | iPhone 14–16 families |\n|---|---|\n| US LL/A | eSIM only |\n| Canada VC/A | Nano-SIM + eSIM |\n| UK B/A | Nano-SIM + eSIM |\n| Japan J/A | Nano-SIM + eSIM |\n\n[Apple model identification](https://support.apple.com/en-us/108044).']:[])].join('\n\n')+'\n'
}
