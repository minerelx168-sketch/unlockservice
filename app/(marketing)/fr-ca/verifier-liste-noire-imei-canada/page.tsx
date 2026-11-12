import { LocalLanding, localMeta } from '@/components/local-landing'
export const dynamic='force-dynamic'
export const metadata=localMeta(3,true)
export default function Page(){return <LocalLanding i={3} fr={true}/>}
