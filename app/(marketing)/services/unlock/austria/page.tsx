import { PublishedModelLinks } from '@/components/published-model-links'
import {Market,marketMeta} from '@/components/geo-market'
export const dynamic='force-dynamic'
export function generateMetadata(){return marketMeta(4,'en')}
export default function Page(){return <><Market i={4} l="en"/><PublishedModelLinks hub="/services/unlock/austria"/></>}
