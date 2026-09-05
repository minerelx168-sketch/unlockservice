/**
 * The four conversations the contact form covers.
 *
 * Kept in a module of its own because the form is a client component: any
 * import that reaches lib/contact.ts drags the database and next/headers
 * into the browser bundle, which does not build.
 */
export const CONTACT_TOPICS = [
  'An order I have placed',
  'Before I order',
  'Payment or credit',
  'Something else',
] as const

export type ContactTopic = (typeof CONTACT_TOPICS)[number]
