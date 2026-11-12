import {ArticleIndex,indexMetadata} from '@/components/article-index'
export const generateMetadata=()=>indexMetadata('de')
export default function Page(){return <ArticleIndex locale="de"/>}
