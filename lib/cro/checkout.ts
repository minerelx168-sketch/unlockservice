import { cookies } from 'next/headers'
import { CRO_COOKIE, allVariants, applyOrderBump, envOverrides, validVisitorId, variantSummary } from './experiments'
import { recordCheckout } from './store'

/**
 * What a checkout request carries for the experiments: the product after the
 * CRO-05 order bump (decided here from the httpOnly cookie, never trusted from
 * the browser), Whop metadata strings, and a recorder for the new reference.
 */
export async function croCheckout(requestedCode: string, orderBumpRequested: unknown) {
  const visitor = validVisitorId((await cookies()).get(CRO_COOKIE)?.value)
  const variants = allVariants(visitor, envOverrides())
  const summary = variantSummary(variants)
  const { productCode, bumped } = applyOrderBump(requestedCode, orderBumpRequested === true, variants['CRO-05'])
  return {
    productCode,
    bumped,
    metadata: { cro_variants: summary, order_bump_accepted: bumped ? 'true' : 'false' } as Record<string, string>,
    record(reference: string) {
      if (!visitor) return
      try { recordCheckout({ reference, visitor, variants: summary, productCode, orderBump: bumped }) } catch { /* Measurement never blocks payment. */ }
    },
  }
}
