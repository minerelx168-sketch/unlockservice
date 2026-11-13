import {articleLabels} from '@/lib/article-labels'
import {QuickImeiCheckCard} from './QuickImeiCheckCard'
import {geoOffers} from '@/lib/geo-offers'
import widgetStyles from '@/styles/article-carrier-widget.module.css'
import { ArticleCarrierWidget } from '@/components/article-carrier-widget'
import { ArticleCta } from '@/components/cro/article-cta'
import { ServiceDirectory } from '@/components/service-directory'
import { SERVICE_SPOKES } from '@/lib/service-spokes'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArticleBody } from '@/components/article-body'
import { ArticleStructuredData } from '@/components/article-structured-data'
import { Icon } from '@/components/icons'
import { getArticle, articleLanguages, articlePath, articleIndexPath, type ArticleLocale, relatedArticles } from '@/lib/articles'
import { publicOrigin } from '@/lib/site'

export async function articleMetadata(locale:ArticleLocale,{
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = getArticle(slug,locale)
  if (!article) return { title: 'Guide not found' }

  const url = `${publicOrigin()}${articlePath(article)}`
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: articlePath(article), languages: articleLanguages(publicOrigin(),article) },
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

function readable(date: string, locale:ArticleLocale) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(locale==='en'?'en-GB':locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export async function ArticlePage({ params,locale }: { params: Promise<{ slug: string }>;locale:ArticleLocale }) {
  const { slug } = await params
  const article = getArticle(slug,locale)
  if (!article) notFound()

  const labels=articleLabels[locale],index=articleIndexPath(locale)
  const contents = article.blocks.filter((block) => block.kind === 'h2')
  const related = relatedArticles(article.slug,2,locale)

  return (
    <>
      <ArticleStructuredData article={article} />

      <section className={`section section--tint ${widgetStyles.articleHero}`}>
        <div className="shell">
          <nav className="service-breadcrumb" aria-label={labels[0]}>
            <Link href={locale==="en"?"/":"/"+locale}>{labels[0]}</Link>
            <span aria-hidden="true">/</span>
            <Link href={index}>{labels[1]}</Link>
            <span aria-hidden="true">/</span>
            <span>{article.topic}</span>
          </nav>

          <div className="article-head">
            <h1 className="t-section">{article.heading}</h1>
            <p className="t-lead">{article.standfirst}</p>
            <ArticleCta locale={locale==="fr-ca"?"fr":locale}>{locale==="en"?<ArticleCarrierWidget />:<div className="hero-panel"><QuickImeiCheckCard locale={locale==="fr-ca"?"fr":locale} products={geoOffers("imei_check",["APPLE_CARRIER_LITE"])}/></div>}</ArticleCta>
            <p className="t-micro article-meta">
              <Link href="/contact">iUnlockMobile</Link> · {labels[2]} {readable(article.published,locale)}
              {article.updated !== article.published ? ` · ${labels[3]} ${readable(article.updated,locale)}` : ''} ·{' '}
              {article.minutes} {labels[4]}
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell article-layout">
          <div className="article-content">
            {locale==='en' && slug==='how-to-find-carrier-on-iphone-before-unlock' && <p><Link href="/services/imei-check/apple-carrier-lock-status">Compare free checks with Lite and Pro carrier reports, see current prices, or enter your IMEI.</Link></p>}
            <ArticleBody blocks={article.blocks} />
            {locale==="en" && <ServiceDirectory
              services={SERVICE_SPOKES.filter(service => service.domain === 'imei_check' || /\batt\b|at&t/i.test(`${article.slug} ${article.topic}`))}
              title="Compare relevant service prices"
            />}

            {article.faq?.length ? (
              <div className="article-faq">
                <h2 id="questions">{labels[5]}</h2>
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
              <details className="article-contents">
                <summary>{labels[6]}</summary>
                <nav aria-label={labels[6]}>
                <ul>
                  {contents.map((block) => (
                    <li key={block.id}>
                      <a href={`#${block.id}`}>{block.text}</a>
                    </li>
                  ))}
                  {article.faq?.length ? (
                    <li>
                      <a href="#questions">{labels[5]}</a>
                    </li>
                  ) : null}
                </ul>
                </nav>
              </details>
            ) : null}

            {related.length ? (
              <div className="article-related">
                <span className="kicker">{labels[7]}</span>
                <ul>
                  {related.map((entry) => (
                    <li key={entry.slug}>
                      <Link href={articlePath(entry)}>{entry.title}</Link>
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
