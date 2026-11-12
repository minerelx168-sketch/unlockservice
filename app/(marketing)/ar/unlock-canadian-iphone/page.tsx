import {Market,marketMeta} from '@/components/geo-market'
export const dynamic='force-dynamic'
export function generateMetadata(){return marketMeta(2,'ar')}
export default function Page(){return <Market i={2} l="ar"/>}
