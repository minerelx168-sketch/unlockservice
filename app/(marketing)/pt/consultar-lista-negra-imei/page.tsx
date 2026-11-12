import {Market,marketMeta} from '@/components/geo-market'
export const dynamic='force-dynamic'
export function generateMetadata(){return marketMeta(3,'pt')}
export default function Page(){return <Market i={3} l="pt"/>}
