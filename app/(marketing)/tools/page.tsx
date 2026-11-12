import {toolList} from '@/lib/geo-tools'
import {pageMetadata} from '@/lib/seo'
export const metadata=pageMetadata('/tools','Free iPhone buyer tools','Check a part number, validate an IMEI, compare hardware and review carrier unlock rules before buying.')
export default function Tools(){return <main className="shell section stack"><h1>Free tools for used iPhone buyers</h1><p>No account or paid lookup is needed for these calculations.</p>{toolList.map(t=><section className="requirements-card" key={t.slug}><h2><a href={'/tools/'+t.slug}>{t.title}</a></h2><p>{t.intro}</p></section>)}</main>}
