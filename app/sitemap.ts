import { getPublishedProgrammaticRoutes } from '@/lib/data/programmatic-rollout'
import {toolList} from '@/lib/geo-tools'
import {clusters} from '@/lib/landing-locales'
import { SERVICE_SPOKES } from '@/lib/service-spokes'
import type { MetadataRoute } from 'next'
import { articleLocales,articleIndexPath,articlePath,articleLanguages,listArticles } from '@/lib/articles'
import { unlockOrderingEnabled } from '@/lib/provider'
import { publicOrigin } from '@/lib/site'

/* The waitlist route only exists while unlock ordering is closed, so the
   list has to be built per request rather than frozen at build time. */
export const dynamic = 'force-dynamic'

/** The pages a signed-out visitor can actually read. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicOrigin()
  return [
    ...getPublishedProgrammaticRoutes().map(route => ({ url: origin + route.path, lastModified: new Date(route.publishedDate) })),
    { url: origin+'/reports/2026-used-iphone-carrier-lock-report', lastModified: new Date('2026-11-12') },
    ...([...new Set([...clusters.flatMap(c=>c.slice(1)), '/services/unlock/austria','/services/unlock/uk','/services/unlock/japan','/es','/fr-ca','/pt','/de','/ar','/tools', ...toolList.map(t=>'/tools/'+t.slug)])].map(path=>({url:origin+path}))),
    ...SERVICE_SPOKES.map(s => ({ url: `${origin}${s.path}` })),
    { url: `${origin}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${origin}/services`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${origin}/services/unlock/us`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${origin}/services/unlock`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${origin}/services/imei-check`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${origin}/check`, changeFrequency: 'monthly', priority: 0.8 },
    ...articleLocales.map(locale=>({url:origin+articleIndexPath(locale),alternates:{languages:articleLanguages(origin)},priority:0.7})),
    ...(['/services/unlock/canada','/articles/used-iphone-imei-unlock-legitimacy-checklist','/articles/rogers-telus-sim-locked-us-iphone-in-canada'].map(path => ({url:origin+path}))),
    ...articleLocales.flatMap(l=>listArticles(l)).filter(a=>a.locale && a.locale!=='en' || a.slug!=='imei-unlock-iphone-service-checklist').map((article) => ({
      url: origin+articlePath(article),
      ...(article.translationGroup?{alternates:{languages:articleLanguages(origin,article)}}:{}),
      lastModified: new Date(`${article.updated}T00:00:00Z`),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    { url: `${origin}/support`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${origin}/track`, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${origin}/contact`, changeFrequency: 'yearly', priority: 0.6 },
    ...(unlockOrderingEnabled()
      ? []
      : [{ url: `${origin}/unlock-waitlist`, changeFrequency: 'weekly' as const, priority: 0.6 }]),
    { url: `${origin}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${origin}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
