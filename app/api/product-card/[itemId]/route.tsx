/** @jsxRuntime automatic */
import { ImageResponse } from 'next/og'
import { feedEntry, feedPrice, publicFeedProduct } from '@/lib/acp-feed'
import { liveResolver } from '@/lib/acp-feed-live'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 1200×1200 PNG product card for the ACP feed's image_url (feeds reject SVG). */
export async function GET(_request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const serviceId = itemId.match(/^IUM-SKU-(\d{1,6})\.png$/)?.[1]
  const entry = serviceId ? feedEntry(serviceId) : undefined
  const found = serviceId ? publicFeedProduct(serviceId, liveResolver) : null
  if (!entry || !found) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  const [headline, detail] = entry.title.split(' — ')
  const price = '$' + feedPrice(found.offer.priceCents)
  const eta = found.product.etaLabel.replace(/\s+/g, ' ').trim()
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 96, background: '#f7f9fc', color: '#0f1b2d', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: '#1f5eff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 700 }}>i</div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>iUnlockMobile</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.08 }}>{headline}</div>
          {detail ? <div style={{ fontSize: 40, color: '#45546b', lineHeight: 1.25 }}>{detail}</div> : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'baseline' }}>
            <div style={{ fontSize: 96, fontWeight: 800, color: '#1f5eff' }}>{price}</div>
            <div style={{ fontSize: 36, color: '#45546b' }}>{'Delivery: ' + eta}</div>
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', padding: '16px 28px', borderRadius: 999, border: '3px solid #1f5eff', color: '#1f5eff', fontSize: 32, fontWeight: 700 }}>iUnlockMobile Verified IMEI Service</div>
        </div>
      </div>
    ),
    { width: 1200, height: 1200, headers: { 'Cache-Control': 'public, max-age=3600' } },
  )
}
