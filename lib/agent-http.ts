import {consumeAttempt} from './rate-limit'
import {clientIp} from './ga4'
import {invoke} from './agent-discovery'
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})
export function throttle(req:Request){
 if(!consumeAttempt('public-agent',clientIp(req.headers)??'shared',60,60))return Response.json({error:'Rate limit reached'},{status:429,headers:{'Retry-After':'60','Cache-Control':'no-store'}})
}
export function rest(req:Request,name:string){const limited=throttle(req);if(limited)return limited
 try{return json(invoke(name,Object.fromEntries(new URL(req.url).searchParams)))}catch{return json({error:'Invalid tool arguments'},400)}}
