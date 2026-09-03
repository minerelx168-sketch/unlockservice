import { PUBLIC_PROVIDER_PRODUCTS, type ProviderProduct } from '@/lib/provider-products'

function customerText(value: string) {
  return value
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function customerProduct(product: ProviderProduct): ProviderProduct {
  return {
    ...product,
    name: customerText(product.name),
    group: customerText(product.group),
    summary: customerText(product.summary),
    etaLabel: customerText(product.etaLabel),
  }
}

export const CUSTOMER_IMEI_CHECK_PRODUCTS = PUBLIC_PROVIDER_PRODUCTS
  .filter((product) => product.domain === 'imei_check')
  .map(customerProduct)

export const CUSTOMER_UNLOCK_PRODUCTS = PUBLIC_PROVIDER_PRODUCTS
  .filter((product) => product.domain === 'unlock')
  .map(customerProduct)

export const CUSTOMER_PRODUCT_COUNTS = {
  imeiCheck: CUSTOMER_IMEI_CHECK_PRODUCTS.length,
  unlock: CUSTOMER_UNLOCK_PRODUCTS.length,
  total: CUSTOMER_IMEI_CHECK_PRODUCTS.length + CUSTOMER_UNLOCK_PRODUCTS.length,
}
