import type { MetadataRoute } from 'next'
import { unlockOrderingEnabled } from '@/lib/provider'
import { publicOrigin } from '@/lib/site'

/* The waitlist route only exists while unlock ordering is closed, so the
   list has to be built per request rather than frozen at build time. */
export const dynamic = 'force-dynamic'

/** The pages a signed-out visitor can actually read. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicOrigin()
  return [
    { url: `${origin}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${origin}/services`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${origin}/services/unlock`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${origin}/services/imei-check`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${origin}/check`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${origin}/contact`, changeFrequency: 'yearly', priority: 0.6 },
    ...(unlockOrderingEnabled()
      ? []
      : [{ url: `${origin}/unlock-waitlist`, changeFrequency: 'weekly' as const, priority: 0.6 }]),
    { url: `${origin}/register`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${origin}/login`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${origin}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${origin}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
