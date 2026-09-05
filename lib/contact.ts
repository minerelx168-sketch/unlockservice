import { emailDeliveryConfigured, sendTransactionalEmail } from './account-security'
import { CONTACT_TOPICS, type ContactTopic } from './contact-topics'
import { db } from './db'
import { consumeAttempt } from './rate-limit'
import { supportEmail } from './site'

export { CONTACT_TOPICS, type ContactTopic }

/**
 * Messages from the contact form.
 *
 * The row is written first and the email is sent second, so a message is
 * never lost to a mail provider being down or unconfigured — support can
 * read `contact_messages` and answer from there. `delivered_at` says which
 * of the two happened.
 */

export class ContactError extends Error {
  constructor(
    message: string,
    readonly code: 'email_invalid' | 'message_missing' | 'message_too_long' | 'rate_limited',
  ) {
    super(message)
    this.name = 'ContactError'
  }
}

export type ContactInput = {
  name?: string
  email: string
  topic?: string
  message: string
  orderRef?: string
  userId?: number
}

const MESSAGE_MIN = 10
const MESSAGE_MAX = 4_000
const FIELD_MAX = 200

function clean(value: string | undefined, limit = FIELD_MAX) {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function submitContactMessage(input: ContactInput): Promise<{ delivered: boolean }> {
  const email = clean(input.email).toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new ContactError('Enter an email address we can reply to.', 'email_invalid')
  }

  /* Newlines survive here — a message is prose. Everything else is a
     single line by the time it reaches the inbox. */
  const message = input.message.trim()
  if (message.length < MESSAGE_MIN) {
    throw new ContactError('Tell us a little more so we can help.', 'message_missing')
  }
  if (message.length > MESSAGE_MAX) {
    throw new ContactError(
      `That is longer than we can take here (${MESSAGE_MAX} characters). Email us the rest.`,
      'message_too_long',
    )
  }

  const name = clean(input.name)
  const orderRef = clean(input.orderRef, 64)
  const topic = CONTACT_TOPICS.includes(clean(input.topic) as ContactTopic)
    ? clean(input.topic)
    : CONTACT_TOPICS[CONTACT_TOPICS.length - 1]

  /* Five an hour per address. Enough for someone who hit send twice and
     then remembered one more thing; not enough to relay mail through us. */
  if (!consumeAttempt('contact-message', email, 5, 60 * 60)) {
    throw new ContactError('Too many messages. Please try again later.', 'rate_limited')
  }

  const inserted = db()
    .prepare(
      `INSERT INTO contact_messages (user_id, name, email, topic, message, order_ref)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(input.userId ?? null, name || null, email, topic, message, orderRef || null)
  const id = Number(inserted.lastInsertRowid)

  if (!emailDeliveryConfigured()) return { delivered: false }

  const heading = `${topic} — ${name || email}`
  const text = [
    `From: ${name || '(no name given)'} <${email}>`,
    `Topic: ${topic}`,
    orderRef ? `Order reference: ${orderRef}` : null,
    input.userId ? `Signed in as account #${input.userId}` : 'Not signed in',
    '',
    message,
  ]
    .filter((line) => line !== null)
    .join('\n')
  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:620px;margin:auto;padding:24px">` +
    `<p style="margin:0 0 4px"><b>${escapeHtml(name || '(no name given)')}</b> &lt;${escapeHtml(email)}&gt;</p>` +
    `<p style="margin:0 0 4px;color:#475569">${escapeHtml(topic)}` +
    (orderRef ? ` · order ${escapeHtml(orderRef)}` : '') +
    (input.userId ? ` · account #${input.userId}` : ' · not signed in') +
    `</p><hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">` +
    `<div style="white-space:pre-wrap">${escapeHtml(message)}</div></div>`

  try {
    /* Reply-to is the customer, so answering the message is Reply and
       nothing else. */
    await sendTransactionalEmail(supportEmail(), heading, html, text, { replyTo: email })
  } catch {
    /* The row is already saved; the sender is told it arrived because it
       did. The status code is logged by the mail module. */
    console.error('[contact] delivery to support failed', id)
    return { delivered: false }
  }

  db().prepare("UPDATE contact_messages SET delivered_at = datetime('now') WHERE id = ?").run(id)
  return { delivered: true }
}
