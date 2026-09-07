import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArticleBody } from '@/components/article-body'
import { ArticleStructuredData } from '@/components/article-structured-data'
import { Icon } from '@/components/icons'
import { getArticle, listArticles, relatedArticles } from '@/lib/articles'
import { publicOrigin } from '@/lib/site'

/* Every guide is known at build time, so every guide is a static file. */
export function generateStaticParams() {
  return listArticles().map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) return { title: 'Guide not found' }

  const url = `${publicOrigin()}/articles/${article.slug}`
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      type: 'article',
      url,
      title: article.title,
      description: article.description,
      publishedTime: article.published,
      modifiedTime: article.updated,
    },
  }
}

function readable(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) notFound()

  const contents = article.blocks.filter((block) => block.kind === 'h2')
  const related = relatedArticles(article.slug)

  return (
    <>
      <ArticleStructuredData article={article} />

      <section className="section section--tint">
        <div className="shell">
          <nav className="service-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/articles">Guides</Link>
            <span aria-hidden="true">/</span>
            <span>{article.topic}</span>
          </nav>

          <div className="article-head">
            <h1 className="t-section">{article.heading}</h1>
            <p className="t-lead">{article.standfirst}</p>
            <p className="t-micro article-meta">
              Published {readable(article.published)}
              {article.updated !== article.published ? ` · Updated ${readable(article.updated)}` : ''} ·{' '}
              {article.minutes} min read
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell article-layout">
          <div>
            <ArticleBody blocks={article.blocks} />

            {article.faq?.length ? (
              <div className="article-faq">
                <h2 id="questions">Common questions</h2>
                {/* Same markup as the homepage FAQ, including the .plus
                    wrapper the icon is sized by — a bare icon in a summary
                    inherits nothing and renders enormous. */}
                <div className="faq-list">
                  {article.faq.map((entry, index) => (
                    <details className="faq-item" key={entry.question} open={index === 0}>
                      <summary>
                        {entry.question}
                        <span className="plus" aria-hidden="true">
                          <Icon name="plus" strokeWidth={2.6} />
                        </span>
                      </summary>
                      <div className="answer">{entry.answer}</div>
                    </details>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="article-aside">
            {contents.length ? (
              <nav className="article-contents" aria-label="On this page">
                <span className="kicker">On this page</span>
                <ul>
                  {contents.map((block) => (
                    <li key={block.id}>
                      <a href={`#${block.id}`}>{block.text}</a>
                    </li>
                  ))}
                  {article.faq?.length ? (
                    <li>
                      <a href="#questions">Common questions</a>
                    </li>
                  ) : null}
                </ul>
              </nav>
            ) : null}

            {related.length ? (
              <div className="article-related">
                <span className="kicker">Read next</span>
                <ul>
                  {related.map((entry) => (
                    <li key={entry.slug}>
                      <Link href={`/articles/${entry.slug}`}>{entry.title}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </>
  )
}
