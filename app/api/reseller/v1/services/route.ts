import { authenticateReseller,resellerError,resellerResponse,resellerServices } from '@/lib/reseller'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request:Request) {
  try { authenticateReseller(request);return resellerResponse({services:resellerServices()}) }catch(error){return resellerError(error)}
}
