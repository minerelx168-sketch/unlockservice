import {ArticleIndex,indexMetadata} from '@/components/article-index'
export const generateMetadata=()=>indexMetadata('pt')
export default function Page(){return <ArticleIndex locale="pt"/>}
