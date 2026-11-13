import { cookies, headers } from 'next/headers'
import { AI_HEADER, AI_REFERRAL_COOKIE, CRO_COOKIE, CRO_HEADER, allVariants, envOverrides, isForced, validAiReferral, validVisitorId, variantFor, variantSummary, type ExperimentId, type Variant } from './experiments'

/** The visitor id: the middleware's header on a first visit, the cookie after. */
export async function croVisitor(): Promise<string | null> {
  const fromHeader = validVisitorId((await headers()).get(CRO_HEADER))
  return fromHeader ?? validVisitorId((await cookies()).get(CRO_COOKIE)?.value)
}

export type CroAssignment = { experiment: ExperimentId; variant: Variant; tracked: boolean }

/** Resolve one experiment during the server render, so the HTML is final. */
export async function croAssignment(experiment: ExperimentId): Promise<CroAssignment> {
  const overrides = envOverrides()
  const visitor = await croVisitor()
  return { experiment, variant: variantFor(visitor, experiment, overrides), tracked: Boolean(visitor) && !isForced(experiment, overrides) }
}

export async function croVariantSummary(): Promise<{ visitor: string | null; summary: string; variants: Record<ExperimentId, Variant> }> {
  const visitor = await croVisitor()
  const variants = allVariants(visitor, envOverrides())
  return { visitor, summary: variantSummary(variants), variants }
}

/** The assistant that referred this session, if any (CRO-03 eligibility). */
export async function aiReferral(): Promise<string | null> {
  return validAiReferral((await headers()).get(AI_HEADER)) ?? validAiReferral((await cookies()).get(AI_REFERRAL_COOKIE)?.value)
}
