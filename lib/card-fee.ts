// Applied only to new card top-ups. Store the quoted fee on the invoice so
// retries, old checkout links and refunds keep their original amounts.
export const CARD_FEE_PERCENT = 5

export function cardFeeCents(creditCents: number): number {
  if (!Number.isSafeInteger(creditCents) || creditCents < 0) throw new RangeError('Invalid credit amount.')
  return Math.round(creditCents * CARD_FEE_PERCENT / 100)
}
