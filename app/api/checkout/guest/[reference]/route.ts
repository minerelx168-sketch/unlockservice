import { NextResponse } from 'next/server'
import { authorizedGuestCheckout, guestResult } from '@/lib/guest-checkout'
export const dynamic='force-dynamic'
export async function GET(request:Request,{params}:{params:Promise<{reference:string}>}) {
  const row=authorizedGuestCheckout((await params).reference,request.headers.get('x-order-key')??'')
  return NextResponse.json(row ? guestResult(row) : {error:'Order not found.'},{status:row?200:404,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}})
}
