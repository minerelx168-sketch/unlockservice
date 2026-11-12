import {Market,marketMeta} from '@/components/geo-market'
export const dynamic='force-dynamic'
export function generateMetadata(){return marketMeta(0,'ar')}
export default function Page(){return <Market i={0} l="ar"/>}
