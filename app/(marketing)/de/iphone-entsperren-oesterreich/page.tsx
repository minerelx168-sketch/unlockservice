import {Market,marketMeta} from '@/components/geo-market'
export const dynamic='force-dynamic'
export function generateMetadata(){return marketMeta(4,'de')}
export default function Page(){return <Market i={4} l="de"/>}
