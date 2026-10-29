import { captureCheckoutContext } from './checkout-context-request'
import { recordTrackingCapture } from './tracking-diagnostics'
import { serverPurchasesEnabled } from './purchase-analytics'
import { cookies } from 'next/headers'
import { CONSENT_COOKIE } from './cookie-names'
import { parseSignedConsent } from './order-attribution'
import { savePurchaseAnalytics } from './purchase-analytics'
export async function snapshotPurchaseAnalytics(userId:number,kind:'order'|'paid_imei_report',requestKey:unknown,input:unknown) {
  try {
    const consent=parseSignedConsent((await cookies()).get(CONSENT_COOKIE)?.value)
    savePurchaseAnalytics(userId,kind,typeof requestKey==='string'?requestKey:'',input,consent?.consent!=='denied')
    recordTrackingCapture(kind, typeof requestKey==='string'?requestKey:'', userId, input, consent?.consent !== 'denied', serverPurchasesEnabled())
    await captureCheckoutContext(kind, typeof requestKey==='string'?requestKey:'', userId, input)
  } catch { /* Optional measurement must never block an order. */ }
}
