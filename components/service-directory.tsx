import Link from 'next/link'
import { SERVICE_SPOKES, type ServiceSpoke } from '@/lib/service-spokes'
import { publicOrigin } from '@/lib/site'
import { serializeJsonLd } from '@/lib/json-ld'
import styles from '@/styles/service-directory.module.css'

/** The same server-rendered links describe the list to readers and crawlers. */
export function ServiceDirectory({
  services = SERVICE_SPOKES,
  title = 'Service prices and requirements',
}: {
  services?: readonly ServiceSpoke[]
  title?: string
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    itemListElement: services.map((service, index) => ({
      '@type': 'ListItem', position: index + 1,
      name: service.title, url: publicOrigin() + service.path,
    })),
  }
  return <section className={styles.directory} aria-label={title}>
    <h2>{title}</h2>
    <p>See current service prices, card totals, delivery estimates and eligibility before entering device details.</p>
    <ul>{services.map(service => <li key={service.path}>
      <Link href={service.path}>{service.title}</Link>
      <p>{service.description}</p>
    </li>)}</ul>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />
  </section>
}
