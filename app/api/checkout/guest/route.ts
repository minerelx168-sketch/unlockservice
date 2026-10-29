import { after, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHash } from 'node:crypto'
import { createGuestCheckout, sendGuestCheckoutLink } from '@/lib/guest-checkout'
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
  if(request.headers.get('origin')!==publicOrigin() || request.headers.get('sec-fetch-site')==='cross-site') {
    return NextResponse.json({error:'Cross-site request refused.'},{status:403})
  }
  const ip=request.headers.get('x-real-ip') || 'unknown'
  if(!consumeAttempt('guest-checkout-ip',createHash('sha256').update(ip).digest('hex'),20,3600)) return NextResponse.json({error:'Too many requests. Try again later.'},{status:429})
  try {
    const body=await readCommandJson(request)
    if(body.acceptedTerms!==true) throw new WhopPaymentError('Confirm the service requirements and terms before paying.')
    const consent=parseSignedConsent((await cookies()).get(CONSENT_COOKIE)?.value)?.consent==='granted'
    const found=await currentSession()
    if(found?.user.account_type==='reseller') throw new WhopPaymentError('Use your reseller wallet to order at reseller prices.',409)
    const context=body.analyticsContext as {clientId:string;sessionId:string}|undefined
    const result=await createGuestCheckout({productCode:String(body.productCode??''),imei:String(body.imei??''),email:String(body.email??''),
      requestKey:String(body.requestKey??''),expectedPriceCents:Number(body.expectedPriceCents),authenticatedUserId:found?.user.id,
      analytics: consent && found?.user.account_type!=='admin' ? context : undefined})
    after(() => sendGuestCheckoutLink(result.reference))
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}})
  } catch(error) {
    return NextResponse.json({error:error instanceof WhopPaymentError ? error.message : 'Checkout is temporarily unavailable. Please retry; no order has been placed.'},
      {status:error instanceof WhopPaymentError ? error.status : 503,headers:{'Cache-Control':'no-store'}})
  }
}

