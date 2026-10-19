import { cookies } from 'next/headers'
import { currentSession } from '@/lib/auth'
import { CONSENT_COOKIE } from '@/lib/cookie-names'
import { parseSignedConsent } from '@/lib/order-attribution'
import { readCommandJson } from '@/lib/request-json'
import { consumeAttempt } from '@/lib/rate-limit'
import { EngagementError, recordEngagement } from '@/lib/customer-engagement'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  let sameOrigin = false
  try { const origin = new URL(request.headers.get('origin') ?? ''); sameOrigin = origin.host === (request.headers.get('host') ?? new URL(request.url).host) && ['http:','https:'].includes(origin.protocol) } catch { /* deny */ }
  if (!sameOrigin || request.headers.get('x-requested-with')!=='XMLHttpRequest') return Response.json({ error:'Invalid origin.' },{status:403,headers})
  const found = await currentSession()
  const consent = parseSignedConsent((await cookies()).get(CONSENT_COOKIE)?.value)
  if (!found || found.user.account_type==='admin' || consent?.consent!=='granted') return Response.json({ tracked:false,userId:null },{headers})
  if (!consumeAttempt('customer-engagement',String(found.user.id),40,60)) return Response.json({error:'Try again later.'},{status:429,headers})
  try {
    const body = await readCommandJson(request)
    const result = recordEngagement(found.user.id,body)
    return Response.json({ tracked:true,...result },{headers})
  } catch (error) {
    if (error instanceof EngagementError) return Response.json({error:error.message},{status:400,headers})
    return Response.json({error:'Activity unavailable.'},{status:400,headers})
  }
}
