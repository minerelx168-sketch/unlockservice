import {homePaths,paths,locales,markets,type GeoLocale} from '../geo-locales'
export const prefixes=['en','es','fr-ca','pt','de','ar'] as const
export const localeOf=(path:string):GeoLocale=>locales[Math.max(0,prefixes.indexOf(path.split('/')[1] as typeof prefixes[number]))]
export const prefixOf=(l:GeoLocale)=>homePaths[locales.indexOf(l)]
export function routeFor(path:string,l:GeoLocale){const clean=path.split(/[?#]/)[0].replace(/\/$/,'')||'/';if(['/track','/support','/contact','/services'].includes(clean))return clean;if(clean==='/checkout'||/^\/(es|fr-ca|pt|de|ar)\/checkout$/.test(clean))return (l==='en'?'':prefixOf(l))+'/checkout';const row=paths.find(r=>r.includes(clean))??(clean==='/services/imei-check'?paths[0]:homePaths);return row[locales.indexOf(l)]}
export function languageLinks(path:string):Record<string,string>{return Object.fromEntries([...markets.map((tag,i)=>[tag,routeFor(path,locales[i])]),['en-CA',routeFor(path,'en')],['x-default',routeFor(path,'en')]])}
export function effectiveLocale(path:string,cookie:string){return /^\/(?:track|support|contact|services)\/?$/.test(path.split('?')[0])?localeOf('/'+cookie):localeOf(path)}
