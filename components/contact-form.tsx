'use client'

import { useActionState, useState, type FormEvent } from 'react'
import { sendContactMessageAction, type FormState } from '@/lib/actions'
import { CONTACT_TOPICS } from '@/lib/contact-topics'
import { Icon } from './icons'

const EMPTY: FormState = {}
const MESSAGE_MAX = 4_000

/**
 * The contact form.
 *
 * Everything is one column and the topic is a select rather than free
 * text, because the first thing support needs to know is which of four
 * conversations this is, and a subject line rarely says.
 */
export function ContactForm({ defaultEmail = '' }: { defaultEmail?: string }) {
  const [state, action, pending] = useActionState(sendContactMessageAction, EMPTY)

  /* Every field is controlled on purpose. React resets a form once its
     action returns, so an uncontrolled input is emptied by the very
     validation error that asks the customer to try again — they would
     retype their address to be told about a different field. */
  const [name, setName] = useState('')
  const [email, setEmail] = useState(defaultEmail)
  const [orderRef, setOrderRef] = useState('')
  const [message, setMessage] = useState('')

  if (state.message) {
    return (
      <div className="panel">
        <div className="panel-body stack" style={{ gap: 12 }}>
          <p className="alert alert--success" role="status">
            <Icon name="checkSmall" strokeWidth={2.2} />
            <span>{state.message}</span>
          </p>
          <p className="t-small">
            Replies come from our support address — check the spam folder if nothing arrives, since
            a first email from a new sender often lands there.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form className="panel" action={action} noValidate>
      <header>
        <h2>Send us a message</h2>
        <span>We reply to every one</span>
      </header>

      <div className="panel-body stack" style={{ gap: 18 }}>
        {state.error ? (
          <p className="alert alert--error" role="alert">
            <Icon name="info" strokeWidth={1.9} />
            <span>{state.error}</span>
          </p>
        ) : null}

        {/* Not shown to anyone, and not announced. Bots fill it in. */}
        <div className="contact-trap" aria-hidden="true">
          <label htmlFor="contact-website">Leave this field empty</label>
          <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="field">
          <label htmlFor="contact-name">Your name (optional)</label>
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="How we should address you"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="contact-email">Email</label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            required
          />
          <p className="field-note" data-state="idle">
            <Icon name="info" strokeWidth={1.9} />
            <span>The address we reply to. It is used for nothing else.</span>
          </p>
        </div>

        <div className="field">
          <label htmlFor="contact-topic">What is this about</label>
          <select id="contact-topic" name="topic" defaultValue={CONTACT_TOPICS[0]}>
            {CONTACT_TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="contact-order">Order reference (optional)</label>
          <input
            id="contact-order"
            name="orderRef"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="From the order page or your receipt"
            value={orderRef}
            onChange={(event) => setOrderRef(event.currentTarget.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="contact-message">Message</label>
          <textarea
            id="contact-message"
            name="message"
            rows={7}
            maxLength={MESSAGE_MAX}
            value={message}
            onChange={(event: FormEvent<HTMLTextAreaElement>) => setMessage(event.currentTarget.value)}
            placeholder="The device, what you were trying to do, and what happened."
            required
          />
          <p className="field-note" data-state="idle" aria-live="polite">
            <Icon name="info" strokeWidth={1.9} />
            <span>
              {message.length > MESSAGE_MAX - 400
                ? `${MESSAGE_MAX - message.length} characters left.`
                : 'Never send a password. We will never ask for one.'}
            </span>
          </p>
        </div>

        <button className="button button--primary button--wide" type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send message'}
          <Icon name="arrowRight" strokeWidth={2.2} />
        </button>
      </div>
    </form>
  )
}
