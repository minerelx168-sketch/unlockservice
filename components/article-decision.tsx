import type { Article, ArticleLocale } from '@/lib/articles'
import { decisionsA } from '@/lib/guide-decisions-a'
import { decisionsB } from '@/lib/guide-decisions-b'
import { decisionsC } from '@/lib/guide-decisions-c'
import { editionDecisions } from '@/lib/article-editions-evidence'
import styles from '@/styles/article-carrier-widget.module.css'

const labels: Record<ArticleLocale, readonly [string,string,string,string]> = {
  en:['Start here','What you can check','What it cannot tell you','What to do next'],
  es:['Por dónde empezar','Qué puedes comprobar','Qué no demuestra','Qué hacer después'],
  'fr-ca':['Par où commencer','Quoi vérifier','Ce que cela ne prouve pas','Prochaine étape'],
  pt:['Por onde começar','O que verificar','O que isso não comprova','Próximo passo'],
  de:['So gehen Sie vor','Das können Sie prüfen','Was das nicht belegt','Ihr nächster Schritt'],
  ar:['من أين تبدأ؟','ما يمكنك التحقق منه','ما لا تثبته النتيجة','الخطوة التالية'],
}
type Steps = readonly [string,string,string]
type Source = {href:string;label:string}
const decisions: Record<string,Steps> = {...decisionsA,...decisionsB,...decisionsC,...editionDecisions}
export function DecisionPanel({steps,locale='en',sources}:{steps:Steps;locale?:ArticleLocale;sources:Source[]}) {
  const [title,...terms]=labels[locale]
  return <section className={'article-decision '+styles.decision} aria-labelledby="article-decision-title">
    <h2 id="article-decision-title">{title}</h2>
    <dl>{steps.map((step,i)=><div key={terms[i]}><dt>{terms[i]}</dt><dd>{step}</dd></div>)}</dl>
    {sources.length>0 && <p>{sources.map((s,i)=><span key={s.href}>{i>0?' · ':''}<a href={s.href}>{s.label}</a></span>)}</p>}
  </section>
}
export function ArticleDecision({article}:{article:Article}) {
  const steps=decisions[article.slug]
  if(!steps) return null
  const refs=article.blocks.flatMap(b=>b.kind==='p'?b.links??[]:[]).filter(s=>s.href.startsWith('https://') && !s.href.includes('iunlockmobile.com'))
  const sources=refs.filter((s,i)=>refs.findIndex(x=>x.href===s.href)===i).slice(0,2)
  return <DecisionPanel steps={steps} locale={article.locale} sources={sources}/>
}
