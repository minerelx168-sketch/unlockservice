import type { Article } from '@/lib/articles'
import { publicOrigin } from '@/lib/site'

/**
 * Article, BreadcrumbList and — only where the page really carries the
 * questions — FAQPage.
 *
 * The FAQ entries come from the same array the page renders, because
 * marking up answers a reader cannot see on the page is the one thing in
 * this file that would earn a penalty rather than a rich result.
 */
export function ArticleStructuredData({ article }: { article: Article }) {
  const origin = publicOrigin()
  const url = `${origin}/articles/${article.slug}`

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Organization',
      '@id': `${origin}/#organization`,
      name: 'iUnlockMobile',
      url: origin,
      logo: `${origin}/logo-mark.svg`,
    },
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: article.title,
      description: article.description,
      datePublished: article.published,
      dateModified: article.updated,
      inLanguage: 'en',
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      /* The organisation is the author. Inventing a person with
         credentials to satisfy a checklist is exactly the kind of signal
         that is worth nothing and costs trust. */
      author: { '@id': `${origin}/#organization` },
      publisher: { '@id': `${origin}/#organization` },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: origin },
        { '@type': 'ListItem', position: 2, name: 'Guides', item: `${origin}/articles` },
        { '@type': 'ListItem', position: 3, name: article.title, item: url },
      ],
    },
  ]

  if (article.faq?.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: article.faq.map((entry) => ({
        '@type': 'Question',
        name: entry.question,
        acceptedAnswer: { '@type': 'Answer', text: entry.answer },
      })),
    })
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }),
      }}
    />
  )
}
