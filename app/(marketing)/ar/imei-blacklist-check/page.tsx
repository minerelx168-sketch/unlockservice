import {Market,marketMeta} from '@/components/geo-market'
export const dynamic='force-dynamic'
export function generateMetadata(){return marketMeta(3,'ar')}
export default function Page(){return <Market i={3} l="ar"/>}
