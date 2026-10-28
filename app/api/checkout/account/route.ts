import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { activateGuestAccount } from '@/lib/guest-account'
import { guestOrderPath } from '@/lib/guest-checkout'
import { AuthError,createSession,setSessionCookie,currentSession } from '@/lib/auth'
import { publicOrigin } from '@/lib/site'
import { consumeAttempt } from '@/lib/rate-limit'
import { readCommandJson } from '@/lib/request-json'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(request:Request) {
  const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}
  if(request.headers.get('origin')!==publicOrigin() || request.headers.get('sec-fetch-site')==='cross-site') return NextResponse.json({error:'Cross-site request refused.'},{status:403,headers})
  const ip=createHash('sha256').update(request.headers.get('x-real-ip')||'unknown').digest('hex')
  if(!consumeAttempt('guest-account-ip',ip,20,900)) return NextResponse.json({error:'Too many attempts. Try again later.'},{status:429,headers})
  try {
    const body=await readCommandJson(request),reference=String(body.reference??'')
    const existing=await currentSession()
    const user=activateGuestAccount(reference,String(body.token??''),String(body.password??''),existing?.user.id)
    await setSessionCookie(createSession(user.id))
    return NextResponse.json({url:guestOrderPath(reference)},{headers})
  } catch(error) {
    return NextResponse.json({error:error instanceof AuthError?error.message:'Unable to activate your account right now. Your private tracking link still works.'},{status:error instanceof AuthError?400:503,headers})
  }
}
