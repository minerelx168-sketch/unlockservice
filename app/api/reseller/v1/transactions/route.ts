import { authenticateReseller,resellerError,resellerResponse,resellerLedger,pageCursor } from '@/lib/reseller'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request:Request) {
  try { const userId=authenticateReseller(request);return resellerResponse(resellerLedger(userId,pageCursor(request))) }catch(error){return resellerError(error)}
}
