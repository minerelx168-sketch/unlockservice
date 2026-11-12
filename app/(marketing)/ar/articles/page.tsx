import {ArticleIndex,indexMetadata} from '@/components/article-index'
export const generateMetadata=()=>indexMetadata('ar')
export default function Page(){return <ArticleIndex locale="ar"/>}
