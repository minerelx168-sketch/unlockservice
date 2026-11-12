import { LocalLanding, localMeta } from '@/components/local-landing'
export const dynamic='force-dynamic'
export const metadata=localMeta(2,true)
export default function Page(){return <LocalLanding i={2} fr={true}/>}
