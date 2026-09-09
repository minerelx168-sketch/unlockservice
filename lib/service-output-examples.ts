import examples from '@/catalog/service-output-examples.json'
import { providerProductByCode } from './provider-products'

export type ServiceOutputExampleData = {
  title: string
  variants: Array<{ label: string; output: string }>
}

/** Only explicitly reviewed, public product samples may reach the storefront.
 * Source CSV and provider IDs stay out of the response and client bundle. */
export function getServiceOutputExample(value: unknown): ServiceOutputExampleData | null {
  if (typeof value !== 'string' || !/^[A-Z0-9_]{2,64}$/.test(value)) return null
  const product = providerProductByCode(value)
  if (!product || !['available', 'coming_soon'].includes(product.status)) return null
  if (!Object.hasOwn(examples, value)) return null
  const example = (examples as Record<string, ServiceOutputExampleData>)[value]
  if (!example?.title || !example.variants?.length) return null
  return {
    title: example.title,
    variants: example.variants.map(({ label, output }) => ({ label, output })),
  }
}

export function hasServiceOutputExample(value: unknown) {
  return getServiceOutputExample(value) !== null
}
