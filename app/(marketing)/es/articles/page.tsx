import {ArticleIndex,indexMetadata} from '@/components/article-index'
export const generateMetadata=()=>indexMetadata('es')
export default function Page(){return <ArticleIndex locale="es"/>}
