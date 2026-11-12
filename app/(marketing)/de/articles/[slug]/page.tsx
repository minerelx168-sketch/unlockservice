import {ArticlePage,articleMetadata} from '@/components/article-page'
import {listArticles} from '@/lib/articles'
type Props={params:Promise<{slug:string}>}
export const generateStaticParams=()=>listArticles('de').map(({slug})=>({slug}))
export const generateMetadata=(props:Props)=>articleMetadata('de',props)
export default function Page({params}:Props){return <ArticlePage locale="de" params={params}/>}
