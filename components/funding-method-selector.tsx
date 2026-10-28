'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './icons'
import { CARD_FEE_PERCENT } from '@/lib/card-fee'

export function FundingMethodSelector({ card, cryptocurrency, cryptoDescription }: {
  card?: ReactNode
  cryptocurrency?: ReactNode
  cryptoDescription: string
}) {
  const [selected, setSelected] = useState<'card' | 'crypto' | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (selected === 'crypto') dialog.current?.showModal()
    else dialog.current?.close()
    if (selected !== 'crypto') return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [selected])

  return (
    <div className="funding-method-flow">
      <section className="panel funding-method-selector" aria-labelledby="funding-method-title">
        <header>
          <div>
            <h2 id="funding-method-title">Choose a payment method</h2>
            <p className="t-small">Select one option to enter your amount and see the next steps.</p>
          </div>
        </header>
        <div className="panel-body funding-method-options" role="group" aria-label="Payment methods">
          {card ? (
            <button type="button" className="funding-method-option" aria-pressed={selected === 'card'}
              aria-controls="funding-card-panel" onClick={() => setSelected('card')}>
              <span className="funding-method-symbol"><Icon name="wallet" /></span>
              <span className="funding-method-copy">
                <strong>Credit or debit card</strong>
                <small>Secure checkout with Whop · {CARD_FEE_PERCENT}% fee</small>
              </span>
              <Icon name={selected === 'card' ? 'checkSmall' : 'arrowRight'} />
            </button>
          ) : null}
          {cryptocurrency ? (
            <button type="button" className="funding-method-option" aria-pressed={selected === 'crypto'}
              aria-controls="funding-crypto-panel" onClick={() => setSelected('crypto')}>
              <span className="funding-method-symbol" aria-hidden="true">₮</span>
              <span className="funding-method-copy">
                <strong>Cryptocurrency</strong>
                <small>{cryptoDescription}</small>
              </span>
              <Icon name={selected === 'crypto' ? 'checkSmall' : 'arrowRight'} />
            </button>
          ) : null}
        </div>
      </section>
      <p className="funding-method-status t-small" role="status">
        {selected === 'card' ? 'Card selected. Enter your credit amount below.'
          : selected === 'crypto' ? 'Cryptocurrency selected. Complete your deposit in the popup.'
          : 'Choose a payment method above to get started.'}
      </p>
      {card ? <div id="funding-card-panel" hidden={selected !== 'card'}>{card}</div> : null}
      {cryptocurrency ? <dialog id="funding-crypto-panel" ref={dialog} className="crypto-dialog" aria-label="Crypto deposit" onClose={() => setSelected(null)} onCancel={() => setSelected(null)}>
        <button type="button" className="crypto-close" aria-label="Close crypto deposit" onClick={() => dialog.current?.close()}>×</button>
        {cryptocurrency}
      </dialog> : null}
    </div>
  )
}
