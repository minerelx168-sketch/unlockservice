import { cookies } from 'next/headers'
import { ATTR_FT_COOKIE, ATTR_LT_COOKIE, attributionMetadata, decodeTouch, type Touch } from './ai-attribution'
import { saveOrderAttribution } from './ai-revenue-ledger'

/** The visitor's first and last non-direct touch, read from the middleware cookies. */
export async function readAttributionTouches(): Promise<{ ft: Touch | null; lt: Touch | null }> {
  try {
    const jar = await cookies()
    return { ft: decodeTouch(jar.get(ATTR_FT_COOKIE)?.value), lt: decodeTouch(jar.get(ATTR_LT_COOKIE)?.value) }
  } catch { return { ft: null, lt: null } }
}

/** Whop metadata for a checkout; GA identifiers only when analytics is allowed. */
export async function checkoutAttributionMetadata(productCode: string, analytics?: { clientId?: unknown; sessionId?: unknown }): Promise<Record<string, string>> {
  const { ft, lt } = await readAttributionTouches()
  return attributionMetadata(ft, lt, {
    skuId: productCode,
    gaClientId: typeof analytics?.clientId === 'string' ? analytics.clientId : null,
    gaSessionId: typeof analytics?.sessionId === 'string' ? analytics.sessionId : null,
  })
}

export async function persistCheckoutAttribution(kind: 'guest' | 'crypto', reference: string, productCode: string, analytics?: { clientId?: unknown; sessionId?: unknown }) {
  const { ft, lt } = await readAttributionTouches()
  saveOrderAttribution(kind, reference, ft, lt, {
    skuId: productCode,
    gaClientId: typeof analytics?.clientId === 'string' ? analytics.clientId : null,
    gaSessionId: typeof analytics?.sessionId === 'string' ? analytics.sessionId : null,
  })
}
