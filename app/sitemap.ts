import type { MetadataRoute } from 'next'
import { publicOrigin } from '@/lib/site'

/** The pages a signed-out visitor can actually read. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicOrigin()
  return [
    { url: `${origin}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${origin}/check`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${origin}/register`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${origin}/login`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${origin}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${origin}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
