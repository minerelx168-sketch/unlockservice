import { cardFeeCents } from './card-fee'

/** Direct card selling price in integer USD cents; crypto and account prices stay unchanged. */
export function guestCardQuote(serviceCents: number) {
  if (!Number.isSafeInteger(serviceCents) || serviceCents <= 0) throw new RangeError('Invalid service price.')
  const requiresAccount = false
  const fundingCents = Math.max(100, serviceCents)
  const feeCents = cardFeeCents(fundingCents)
  return { serviceCents, fundingCents, feeCents, totalCents: fundingCents + feeCents,
    walletCreditCents: 0, requiresAccount }
}

