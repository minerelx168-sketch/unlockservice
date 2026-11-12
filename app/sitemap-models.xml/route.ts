import { getPublishedProgrammaticRoutes } from '@/lib/data/programmatic-rollout'
import { publicOrigin } from '@/lib/site'

export function GET() {
  const entries = getPublishedProgrammaticRoutes().map(route =>
    '<url><loc>' + new URL(route.path, publicOrigin()).href + '</loc><lastmod>' + route.publishedDate + '</lastmod></url>')
  return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + entries.join('') + '</urlset>', {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
