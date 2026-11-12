import {ArticlePage,articleMetadata} from '@/components/article-page'
import {listArticles} from '@/lib/articles'
type Props={params:Promise<{slug:string}>}
export const generateStaticParams=()=>listArticles('pt').map(({slug})=>({slug}))
export const generateMetadata=(props:Props)=>articleMetadata('pt',props)
export default function Page({params}:Props){return <ArticlePage locale="pt" params={params}/>}
