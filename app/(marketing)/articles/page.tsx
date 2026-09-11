import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { listArticles } from '@/lib/articles'
import { publicOrigin } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Guides to IMEI checks and network unlocking',
  description:
    'Plain guides to what an IMEI check can tell you, what a network unlock does and does not do, and the checks worth running before buying a used phone.',
  alternates: { canonical: '/articles' },
  openGraph: {
    type: 'website',
    url: `${publicOrigin()}/articles`,
    title: 'Guides to IMEI checks and network unlocking',
    description:
      'Plain guides to IMEI checks, network unlocking, and buying a used phone without inheriting somebody else’s problem.',
  },
}

export default function ArticlesPage() {
  const articles = listArticles()

  return (
    <section className="section section--tint">
      <div className="shell">
        <div className="section-head">
          <span className="kicker">
            <Icon name="file" strokeWidth={2} /> Guides
          </span>
          <h1 className="t-section">IMEI check and phone unlocking guides</h1>
          <p className="t-lead">
            Short guides on the same subjects our support inbox gets asked about: what a number can
            tell you about a handset, what an unlock changes, and how to buy a used phone without
            inheriting somebody else’s problem.
          </p>
        </div>

        <div className="article-grid">
          {articles.map((article) => (
            <article className="card article-card" key={article.slug}>
              <div className="card-topline">
                <span className="kicker">{article.topic}</span>
                <span className="t-micro">{article.minutes} min read</span>
              </div>
              <h2 className="t-card">
                <Link href={`/articles/${article.slug}`}>{article.title}</Link>
              </h2>
              <p className="t-small">{article.standfirst}</p>
              <Link className="link-arrow" href={`/articles/${article.slug}`}>
                Read the guide <Icon name="arrowRight" strokeWidth={2.2} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

