import Link from 'next/link'
import {articleIndexPath,articleLanguages,articlePath,listArticles,type ArticleLocale} from '@/lib/articles'
import {articleLabels} from '@/lib/article-labels'
import {publicOrigin} from '@/lib/site'
export function indexMetadata(locale:ArticleLocale){
  return {title:articleLabels[locale][1],alternates:{canonical:articleIndexPath(locale),languages:articleLanguages(publicOrigin())}}
}
export function ArticleIndex({locale}:{locale:ArticleLocale}){
  const labels=articleLabels[locale]
  return <section className="section section--tint" dir={locale==='ar'?'rtl':'ltr'}><div className="shell">
    <div className="section-head"><span className="kicker">iUnlockMobile</span><h1 className="t-section">{labels[1]}</h1></div>
    <div className="article-grid">{listArticles(locale).map(a=><article className="card article-card" key={a.slug}><div className="card-topline"><span className="kicker">{a.topic}</span><span className="t-micro">{a.minutes} {labels[4]}</span></div><h2 className="t-card"><Link href={articlePath(a)}>{a.title}</Link></h2><p className="t-small">{a.standfirst}</p></article>)}</div>
  </div></section>
}
