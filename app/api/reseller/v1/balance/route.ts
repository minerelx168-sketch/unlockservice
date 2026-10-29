import { authenticateReseller,resellerError,resellerResponse,resellerBalance } from '@/lib/reseller'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request:Request) {
  try { const userId=authenticateReseller(request);return resellerResponse(resellerBalance(userId)) }catch(error){return resellerError(error)}
}
