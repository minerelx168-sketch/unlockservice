import { createHash } from 'node:crypto'
import { NextResponse, after } from 'next/server'
import { getGuestCryptoStatus, submitGuestCryptoTransaction } from '@/lib/guest-crypto'
import { nudgeInvoicePayment } from '@/lib/payment-watcher'
import { consumeAttempt } from '@/lib/rate-limit'
import { publicOrigin } from '@/lib/site'
import { readCommandJson } from '@/lib/request-json'
import { WhopPaymentError } from '@/lib/whop'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}})
type Context={params:Promise<{reference:string}>}
function allowed(request:Request,reference:string) {
  const ip=createHash('sha256').update(request.headers.get('x-real-ip')||'unknown').digest('hex')
  return consumeAttempt('guest-crypto-status-ip',ip,180,60) && consumeAttempt('guest-crypto-status-order',reference,60,60)
}
export async function GET(request:Request,{params}:Context) {
  const {reference}=await params
  if(!allowed(request,reference)) return reply({error:'Please wait before checking again.'},429)
  try {
    const status=await getGuestCryptoStatus(reference,new URL(request.url).searchParams.get('key')??'')
    return status?reply(status):reply({error:'Order not found.'},404)
  } catch { return reply({error:'Payment status is temporarily unavailable. Do not send another payment.'},503) }
}
export async function POST(request:Request,{params}:Context) {
  if(request.headers.get('origin')!==publicOrigin() || request.headers.get('sec-fetch-site')==='cross-site') return reply({error:'Cross-site request refused.'},403)
  const {reference}=await params
  if(!allowed(request,reference)) return reply({error:'Please wait before checking again.'},429)
  try {
    const body=await readCommandJson(request),key=String(body.key??'')
    const invoice=submitGuestCryptoTransaction(reference,key,typeof body.transactionId==='string'?body.transactionId:undefined)
    after(()=>nudgeInvoicePayment(invoice).catch(()=>undefined))
    const status=await getGuestCryptoStatus(reference,key)
    return status?reply(status):reply({error:'Order not found.'},404)
  } catch(error) { return reply({error:error instanceof WhopPaymentError?error.message:'We could not check the payment. Do not send twice.'},error instanceof WhopPaymentError?error.status:503) }
}
