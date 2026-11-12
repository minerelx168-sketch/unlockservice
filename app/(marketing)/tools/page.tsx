import {GuideHero,GuideTile} from '@/components/guide-ui'
import {toolList} from '@/lib/geo-tools'
import {pageMetadata} from '@/lib/seo'
export const metadata=pageMetadata('/tools','Free iPhone buyer tools','Check a part number, validate an IMEI, compare hardware and review carrier unlock rules before buying.')
export default function Tools(){return <section className="guide-page shell"><GuideHero tag="Free device tools" title="Free tools for used iPhone buyers" icon="device"><p>No account or paid lookup is needed for these calculations.</p></GuideHero><div className="guide-tiles">{toolList.map((t,i)=><GuideTile key={t.slug} title={t.title} detail={t.intro} href={'/tools/'+t.slug} icon={(['device','unlockMark','shieldCheck','globe'] as const)[i]}/>)}</div></section>}
