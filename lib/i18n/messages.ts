import en,{type Messages} from './en'
import es from './es'
import fr from './fr'
import pt from './pt'
import de from './de'
import ar from './ar'
import type {GeoLocale} from '../geo-locales'
const dictionaries={en,es,fr,pt,de,ar} satisfies Record<GeoLocale,Messages>
export const msg=(l:GeoLocale,k:keyof Messages)=>dictionaries[l][k]
export function formatServiceMeta(text:string,l:GeoLocale){return l==='en'?text:text.replace(/\b(USA Networks|United Kingdom Networks|Canada Networks|Austria Networks|Japan Networks|Romania Network|working (?:days?|hours?)|unavailable online|available|instant|mins?|minutes?|hours?|days?|to)\b/gi,s=>{if(/^mins?$/i.test(s))return msg(l,'Minutes');const k=Object.keys(en).find(x=>x.toLowerCase()===s.toLowerCase()||x.toLowerCase()===s.toLowerCase()+'s');return k?msg(l,k as keyof Messages):s})}
