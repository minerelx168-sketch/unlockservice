import {Market,marketMeta} from '@/components/geo-market'
export const dynamic='force-dynamic'
export function generateMetadata(){return marketMeta(0,'de')}
export default function Page(){return <Market i={0} l="de"/>}
