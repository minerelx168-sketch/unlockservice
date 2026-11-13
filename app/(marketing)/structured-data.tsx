import { serializeJsonLd } from '@/lib/json-ld'
import { publicOrigin } from '@/lib/site'

/**
 * Organization and FAQPage as JSON-LD.
 *
 * The FAQ entries are passed in from the page that already renders them, so
 * the markup and the visible answers cannot drift apart — a FAQPage whose
 * answers are not on the page is exactly what search engines penalise.
 */
export function StructuredData({ faq }: { faq: ReadonlyArray<{ question: string; answer: string }> }) {
  const origin = publicOrigin()
  const graph = [
    {
      '@type': 'Organization',
      '@id': `${origin}/#organization`,
      name: 'iUnlockMobile',
      url: origin,
      sameAs: (process.env.NEXT_PUBLIC_ORG_SAME_AS ?? process.env.ORGANIZATION_SAME_AS ?? '').split(',').flatMap(raw=>{
        try {const u=new URL(raw.trim()); return u.protocol==='https:' && !u.username && !u.password && /^(www\.)?(github\.com|trustpilot\.com|youtube\.com|x\.com)$/.test(u.hostname) && u.pathname.length>1 ? [u.href] : []}catch{return []}
      }),
      logo: `${origin}/logo-mark.svg`,
    },
    {
      '@type': 'WebSite',
      '@id': `${origin}/#website`,
      url: origin,
      name: 'iUnlockMobile',
      publisher: { '@id': `${origin}/#organization` },
    },
    {
      '@type': 'FAQPage',
      '@id': `${origin}/#faq`,
      mainEntity: faq.map((entry) => ({
        '@type': 'Question',
        name: entry.question,
        acceptedAnswer: { '@type': 'Answer', text: entry.answer },
      })),
    },
  ]

  return (
    <script
      type="application/ld+json"
      /* Escape HTML delimiters in catalog text before embedding JSON-LD. */
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd({ '@context': 'https://schema.org', '@graph': graph }),
      }}
    />
  )
}
