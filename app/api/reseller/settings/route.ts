import { guard } from '@/lib/api'
import { createResellerKey,revokeResellerKey,resellerError,resellerResponse,ResellerError,requireReseller } from '@/lib/reseller'
import { saveResellerWebhook,disableResellerWebhook } from '@/lib/reseller-webhooks'
import { consumeAttempt } from '@/lib/rate-limit'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(request:Request) {
  const guarded=await guard(request)
  if('error' in guarded) return guarded.error
  const {found,body}=guarded
  try {
    requireReseller(found.user.id)
    if(!consumeAttempt('reseller-settings',String(found.user.id),20,3600)) throw new ResellerError('Too many changes. Try again later.',429)
    switch(body.action) {
      case 'create_key': return resellerResponse(createResellerKey(found.user.id,String(body.name??'')))
      case 'revoke_key': {
        const id=Number(body.id);if(!Number.isSafeInteger(id)||id<1) throw new ResellerError('Invalid key ID.')
        revokeResellerKey(found.user.id,id);return resellerResponse({ok:true})
      }
      case 'save_webhook': return resellerResponse(await saveResellerWebhook(found.user.id,String(body.url??'')))
      case 'disable_webhook': disableResellerWebhook(found.user.id);return resellerResponse({ok:true})
      default: throw new ResellerError('Unknown action.')
    }
  }catch(error){return resellerError(error)}
}
