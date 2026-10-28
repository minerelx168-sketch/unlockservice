import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHash } from 'node:crypto'
import { createGuestCryptoCheckout } from '@/lib/guest-crypto'
import { WhopPaymentError } from '@/lib/whop'
import { readCommandJson } from '@/lib/request-json'
import { publicOrigin } from '@/lib/site'
import { consumeAttempt } from '@/lib/rate-limit'
import { CONSENT_COOKIE } from '@/lib/cookie-names'
import { parseSignedConsent } from '@/lib/order-attribution'
import { currentSession } from '@/lib/auth'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(request:Request) {
  const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
  if(request.headers.get('origin')!==publicOrigin() || request.headers.get('sec-fetch-site')==='cross-site') return reply({error:'Cross-site request refused.'},403)
  const ip=request.headers.get('x-real-ip')||'unknown'
  if(!consumeAttempt('guest-checkout-ip',createHash('sha256').update(ip).digest('hex'),20,3600)) return reply({error:'Too many requests. Try again later.'},429)
  try {
    const body=await readCommandJson(request)
    if(body.acceptedTerms!==true) throw new WhopPaymentError('Confirm the service requirements and terms before paying.')
    const consent=parseSignedConsent((await cookies()).get(CONSENT_COOKIE)?.value)?.consent==='granted'
    const found=await currentSession()
    const result=await createGuestCryptoCheckout({productCode:String(body.productCode??''),imei:String(body.imei??''),email:String(body.email??''),
      routeId:String(body.routeId??''),requestKey:String(body.requestKey??''),expectedPriceCents:Number(body.expectedPriceCents),
      analytics:consent && found?.user.account_type!=='admin' ? body.analyticsContext as {clientId:string;sessionId:string}|undefined : undefined})
    return reply(result)
  } catch(error) { return reply({error:error instanceof WhopPaymentError?error.message:'Crypto checkout is temporarily unavailable. Please retry; do not send funds.'},error instanceof WhopPaymentError?error.status:503) }
}
