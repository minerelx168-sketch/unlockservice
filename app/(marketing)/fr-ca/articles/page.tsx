import {ArticleIndex,indexMetadata} from '@/components/article-index'
export const generateMetadata=()=>indexMetadata('fr-ca')
export default function Page(){return <ArticleIndex locale="fr-ca"/>}
