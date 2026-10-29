import { authenticateReseller,resellerError,resellerOrderForUser,resellerResponse,ResellerError } from '@/lib/reseller'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const userId=authenticateReseller(request),{id}=await params
    if(!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id))) throw new ResellerError('Invalid order ID.')
    return resellerResponse({order:resellerOrderForUser(userId,Number(id))})
  }catch(error){return resellerError(error)}
}
