import { cardFeeCents } from './card-fee'

/** Card checkout funding, in integer USD cents; service prices remain unchanged. */
export function guestCardQuote(serviceCents: number) {
  if (!Number.isSafeInteger(serviceCents) || serviceCents <= 0) throw new RangeError('Invalid service price.')
  const requiresAccount = serviceCents < 100
  const fundingCents = Math.max(100, serviceCents)
  const feeCents = cardFeeCents(fundingCents)
  return { serviceCents, fundingCents, feeCents, totalCents: fundingCents + feeCents,
    walletCreditCents: fundingCents - serviceCents, requiresAccount }
}
