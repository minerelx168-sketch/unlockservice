import {ArticlePage,articleMetadata} from '@/components/article-page'
import {listArticles} from '@/lib/articles'
type Props={params:Promise<{slug:string}>}
export const generateStaticParams=()=>listArticles('en').map(({slug})=>({slug}))
export const generateMetadata=(props:Props)=>articleMetadata('en',props)
export default function Page({params}:Props){return <ArticlePage locale="en" params={params}/>}
