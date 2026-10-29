import { after } from 'next/server'
import { authenticateReseller, resellerError, resellerResponse, resellerOrder, resellerOrderList, pageCursor, ResellerError } from '@/lib/reseller'
import { createPaidReport, PaidReportError } from '@/lib/paid-reports'
import { readCommandJson } from '@/lib/request-json'
import { deliverResellerWebhooks } from '@/lib/reseller-webhooks'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request:Request) {
  try {const userId=authenticateReseller(request);return resellerResponse(resellerOrderList(userId,pageCursor(request)))} catch(error){return resellerError(error)}
}
export async function POST(request:Request) {
  try {
    const userId=authenticateReseller(request)
    let body:Record<string,unknown>
    try {body=await readCommandJson(request)} catch {throw new ResellerError('Invalid JSON body.')}
    const key=request.headers.get('idempotency-key')??''
    if(!/^[A-Za-z0-9._:-]{8,100}$/.test(key)) throw new ResellerError('Send an Idempotency-Key header of 8–100 letters, digits, dots, colons, underscores or hyphens.')
    if(body.accepted_terms!==true) throw new ResellerError('Confirm accepted_terms: true for an authorized device and the service terms.')
    if(typeof body.service_code!=='string'||typeof body.identifier!=='string') throw new ResellerError('service_code and identifier are required strings.')
    if(body.expected_price_cents!==undefined&&(!Number.isSafeInteger(body.expected_price_cents)||Number(body.expected_price_cents)<=0)) throw new ResellerError('expected_price_cents must be a positive integer.')
    const result=await createPaidReport(userId,{productCode:body.service_code,imei:body.identifier,idempotencyKey:`reseller:${key}`,
      expectedPriceCents:body.expected_price_cents as number|undefined},'api')
    after(()=>deliverResellerWebhooks(5))
    return resellerResponse({order:resellerOrder(result.order),wallet_balance_cents:result.credit.balanceCents})
  }catch(error){
    if(error instanceof PaidReportError) return resellerResponse({error:error.message,code:error.code},
      error.code==='insufficient_credit'?402:error.code==='rate_limited'?429:error.code==='idempotency_conflict'?409:error.code==='provider_not_ready'?503:422)
    return resellerError(error)
  }
}
