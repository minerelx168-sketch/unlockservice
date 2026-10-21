'use client'

import { useEffect, useId, useRef } from 'react'
import { guestCardQuote } from '@/lib/guest-card-quote'
import { formatUsd } from '@/lib/money'
import { Icon } from './icons'
import '@/styles/order-preview.css'

type PreviewProduct = { code: string; name: string; priceCents: number; etaLabel: string }

/** A live order quote only. Locked bars contain no result or provider data. */
export function OrderPreviewDialog({ open, product, domain, imei, email, pending, error, onClose, onContinue }: {
  open: boolean
  product: PreviewProduct
  domain: 'unlock' | 'imei_check'
  imei: string
  email: string
  pending: boolean
  error?: string
  onClose: () => void
  onContinue: (method: 'card' | 'crypto') => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const isUnlock = domain === 'unlock'
  const cardQuote = guestCardQuote(product.priceCents)
  const total = cardQuote.totalCents

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return <dialog ref={dialog} className="order-preview" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); if (!pending) onClose() }}
    onClick={(event) => { if (event.target === event.currentTarget && !pending) onClose() }}>
    <div className="order-preview__body">
      <div className="order-preview__top"><span className="order-preview__live"><span aria-hidden="true" />Live order preview</span><button type="button" className="order-preview__close" aria-label="Close order preview" disabled={pending} onClick={onClose}><Icon name="cross" /></button></div>
      <h2 id={titleId}>{isUnlock ? 'Ready to unlock your phone?' : 'Your full report starts here.'}</h2>
      <p className="order-preview__service">{product.name}</p>
      <dl className="order-preview__device"><div><dt>IMEI</dt><dd>{imei}</dd></div><div><dt>Result email</dt><dd>{email}</dd></div></dl>
      <div className="order-preview__locked" aria-label="Result is not available before payment and processing">
        <div className="order-preview__placeholder" aria-hidden="true"><span /><span /><span /><span /></div>
        <div className="order-preview__lock-message"><Icon name="lock" /><strong>{isUnlock ? 'Unlock result' : 'Full report'}</strong></div>
      </div>
      <p className="order-preview__timing" id={descriptionId}>Results will be available after payment and processing.</p>
      <dl className="order-preview__quote"><div><dt>Estimated delivery</dt><dd>{product.etaLabel}</dd></div><div><dt>Service</dt><dd>{formatUsd(product.priceCents)}</dd></div>{cardQuote.requiresAccount ? <div><dt>Saved as account credit</dt><dd>{formatUsd(cardQuote.walletCreditCents)}</dd></div> : null}<div><dt>Card fee (5%)</dt><dd>{formatUsd(cardQuote.feeCents)}</dd></div><div className="order-preview__total"><dt>Total before tax</dt><dd>{formatUsd(total)}</dd></div></dl>
      {error ? <p className="order-preview__error" role="alert">{error}</p> : null}
      {cardQuote.requiresAccount ? <p className="order-preview__timing"><strong>Card orders under $1 need an account. {formatUsd(cardQuote.walletCreditCents)} is saved as credit after payment.</strong></p> : null}
      <button type="button" className="button button--primary button--wide" disabled={pending} onClick={() => onContinue('card')}>{pending ? 'Opening secure checkout…' : cardQuote.requiresAccount ? `Continue with card · ${formatUsd(total)}` : `${isUnlock ? 'Order unlock' : 'Unlock full report'} ${formatUsd(total)}`} {!pending ? <Icon name="arrowRight" /> : null}</button>
      <button type="button" className="order-preview__crypto" disabled={pending} onClick={() => onContinue('crypto')}><Icon name="wallet" /><span>Pay with crypto <strong>{formatUsd(product.priceCents)}</strong></span><span className="order-preview__no-fee">No fee</span></button>
      <p className="order-preview__footnote">No crypto minimum · Network or exchange fees may apply.<br />Crypto needs no account or wallet top-up.</p>
      <button className="order-preview__edit" type="button" disabled={pending} onClick={onClose}>Edit my details</button>
    </div>
  </dialog>
}
