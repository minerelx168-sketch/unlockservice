import { iphoneHardwareSpecs } from './iphone-hardware-specs'

import { carrierProfiles, type CarrierProfile } from './carrier-profiles'

type Batch = { publishedDate: string; modelSlugs: readonly string[]; carrierModels?: readonly { model: string; carrier: string }[] }
export const rolloutBatches: readonly Batch[] = [
  {
    publishedDate: '2026-11-12',
    modelSlugs: [
      'iphone-16e', 'iphone-16-pro-max', 'iphone-16-pro', 'iphone-16-plus', 'iphone-16',
      'iphone-15-pro-max', 'iphone-15-pro', 'iphone-15-plus', 'iphone-15', 'iphone-14-pro-max',
    ],
  },
] as const

export function getPublishedProgrammaticRoutes() {
  const dates = new Set<string>()
  const paths = new Set<string>()
  return rolloutBatches.flatMap(batch => {
    if (dates.has(batch.publishedDate) || batch.modelSlugs.length + (batch.carrierModels?.length ?? 0) > 12) {
      throw new Error('Duplicate rollout date or oversized batch')
    }
    dates.add(batch.publishedDate)
    const entries: { slug: string; carrier?: CarrierProfile }[] = batch.modelSlugs.map(slug => ({ slug }))
    for (const entry of batch.carrierModels ?? []) {
      const carrier = carrierProfiles.find(profile => profile.slug === entry.carrier)
      if (!carrier) throw new Error('Unknown carrier: ' + entry.carrier)
      entries.push({ slug: entry.model, carrier })
    }
    return entries.map(({ slug, carrier }) => {
      const model = iphoneHardwareSpecs.find(candidate => candidate.slug === slug)
      const param = slug + '-carrier-lock'
      const hub = carrier?.kind === 'unlock' ? '/services/unlock/' + carrier.country : '/services/imei-check'
      let path = '/check/' + param
      if (carrier) path = carrier.kind === 'check' ? '/check/' + carrier.slug + '/' + slug : hub + '/' + carrier.slug + '/' + slug
      if (!model || paths.has(path)) throw new Error('Unknown model or duplicate route: ' + path)
      paths.add(path)
      return { model, carrier, hub, path, param, publishedDate: batch.publishedDate }
    })
  })
}
