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
      /* Serialised rather than templated: JSON.stringify escapes anything in
         the copy that would otherwise close the script tag early. */
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }),
      }}
    />
  )
}
