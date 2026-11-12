import type {GeoLocale} from '../geo-locales'
import {msg,formatServiceMeta} from './messages'
export function localProduct<T extends {code:string;name:string;summary:string;etaLabel:string}>(p:T,l:GeoLocale):T{
if(l==='en')return p
const t=(k:Parameters<typeof msg>[1])=>msg(l,k)
const names:Record<string,string>={APPLE_CARRIER_LITE:'Apple Carrier Lite · '+t('Carrier check'),BLACKLIST_FULL:'GSMA · '+t('Blacklist check'),BLACKLIST_SIMPLE:'GSMA · '+t('Blacklist check'),UNLOCK_346:'AT&T USA · '+t('Unlock')+' · '+t('Clean devices only'),UNLOCK_36:'Fido / Rogers · iPhone · '+t('Clean devices only'),UNLOCK_39:'Telus / Koodo · iPhone · '+t('Clean devices only'),UNLOCK_329:'SaskTel · iPhone · '+t('Clean devices only'),UNLOCK_289:'Vidéotron · iPhone Premium',UNLOCK_410:'Fido / Rogers · '+t('Generic code'),UNLOCK_711:'Vidéotron · '+t('Generic code'),UNLOCK_87:'Telering · iPhone · '+t('Out of contract'),UNLOCK_84:'A1 Mobikom · iPhone · '+t('Out of contract')+' · '+t('At least two years old'),UNLOCK_384:'3 Hutchison · iPhone Premium',UNLOCK_212:'EMEA · iPhone Premium'}
if(!names[p.code])return {...p,etaLabel:formatServiceMeta(p.etaLabel,l)}
const summary=p.code==='APPLE_CARRIER_LITE'?t('Checks the reported network and SIM lock. It does not unlock the device or check theft reports.'):p.code.startsWith('BLACKLIST')?t('Checks recorded loss or theft at the time of lookup; it does not certify ownership or financing.'):[names[p.code],t('Confirm the original carrier and model. Incorrect submissions may not qualify for a refund.'),p.code==='UNLOCK_36'?t('For a Rogers/Fido Flex policy, activate using a Fido SIM and wait 72 hours before submitting.'):p.code==='UNLOCK_410'?t('Not for iPhone'):''].filter(Boolean).join(' ')
return {...p,name:names[p.code],summary,etaLabel:formatServiceMeta(p.etaLabel,l),category:t(p.code.startsWith('UNLOCK')?'Unlock':'Phone Check')}
}
