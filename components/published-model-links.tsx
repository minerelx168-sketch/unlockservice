import Link from 'next/link'
import { getPublishedProgrammaticRoutes } from '@/lib/data/programmatic-rollout'
import styles from '@/styles/service-spoke.module.css'

export function PublishedModelLinks({ hub }: { hub: string }) {
  const routes = getPublishedProgrammaticRoutes().filter(route => route.hub === hub)
  if (!routes.length) return null
  return <nav className={styles.hubLinks} aria-label="Services by iPhone model">{routes.map(route =>
    <Link key={route.path} href={route.path}>{route.model.displayName} · {route.carrier?.name ?? 'Carrier lock check'}</Link>)}</nav>
}
