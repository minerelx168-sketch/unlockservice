import { headers } from 'next/headers'
import { productSchemaNodes } from '@/lib/acp-feed-live'
import { serializeJsonLd } from '@/lib/json-ld'
import { publicOrigin } from '@/lib/site'

/** Product + Offer + MerchantReturnPolicy JSON-LD; sku and price match the ACP feed row. */
export async function ProductSchema({ path, serviceIds }: { path: string; serviceIds: string[] }) {
  const nodes = productSchemaNodes(serviceIds, publicOrigin() + path)
  if (!nodes.length) return null
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({ '@context': 'https://schema.org', '@graph': nodes }) }} />
}
