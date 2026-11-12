import { currentSession } from '@/lib/auth'
import { listMemberUnlockDirectory } from '@/lib/public-provider-catalog'
export const dynamic = 'force-dynamic'
export async function GET() {
  const headers = {'Cache-Control':'private, no-store', Vary:'Cookie'}
  if (!(await currentSession())) return Response.json({error:'Sign in required'}, {status:401,headers})
  return Response.json({services:listMemberUnlockDirectory()}, {headers})
}
