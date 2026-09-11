import type { Metadata } from 'next'
import { publicOrigin } from './site'

/** Public pages own their canonical; never inherit the homepage URL. */
export function pageMetadata(path: string, title: string, description: string): Metadata {
  const url = new URL(path, publicOrigin()).href
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', siteName: 'iUnlockMobile', url, title, description },
    twitter: { card: 'summary', title, description },
  }
}
