import { isMemberUnlock } from '@/lib/member-unlocks'
import { NextResponse } from 'next/server'
import { getServiceOutputExample } from '@/lib/service-output-examples'

/** Static, curated public samples. No user identifiers, provider calls or orders. */
export async function GET(_request: Request, { params }: { params: Promise<{ productCode: string }> }) {
  const { productCode } = await params
  const member = isMemberUnlock(productCode)
  if (member && !(await (await import('@/lib/auth')).currentSession())) return NextResponse.json({error:'Sign in required'}, {status:401,headers:{'Cache-Control':'private, no-store'}})
  const example = getServiceOutputExample(productCode)
  if (!example) {
    return NextResponse.json({ success: false, error: 'No example is available for this service.' }, {
      status: 404, headers: { 'Cache-Control': 'no-store' },
    })
  }
  return NextResponse.json({ success: true, example }, {
    headers: { 'Cache-Control': member ? 'private, no-store' : 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' },
  })
}
