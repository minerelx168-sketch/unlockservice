import {ArticlePage,articleMetadata} from '@/components/article-page'
import {listArticles} from '@/lib/articles'
type Props={params:Promise<{slug:string}>}
export const generateStaticParams=()=>listArticles('fr-ca').map(({slug})=>({slug}))
export const generateMetadata=(props:Props)=>articleMetadata('fr-ca',props)
export default function Page({params}:Props){return <ArticlePage locale="fr-ca" params={params}/>}
